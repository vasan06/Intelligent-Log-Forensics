import hashlib
import json
import secrets
import smtplib
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Any
import sqlite3
from flask import (
    Blueprint,
    current_app,
    flash,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from aegis_core.analytics.correlator import correlate_and_persist_telemetry
from aegis_core.analytics.mitre_matrix import MITRE_ENTERPRISE_TAXONOMY, lookup_technique
from aegis_core.analytics.trust_engine import calculate_fidelity_rating
from aegis_core.config import SentinelSettings
from aegis_core.dossiers.generator import compile_forensic_dossier_pdf
from aegis_core.parsers.tokenizers import LogStreamTokenizer
from aegis_core.persistence.engine import acquire_connection
def _audit(conn, operator_id, event_type, resource_type=None, resource_id=None, metadata=None):
    conn.execute("INSERT INTO audit_events(operator_ref,event_type,resource_type,resource_id,metadata_json,created_at) VALUES(?,?,?,?,?,?)",
                 (operator_id,event_type,resource_type,resource_id,json.dumps(metadata or {}, separators=(",",":")),SentinelSettings.get_current_utc_timestamp()))

def _send_reset_email(recipient, token):
    if not (SentinelSettings.SMTP_HOST and SentinelSettings.SMTP_FROM):
        raise RuntimeError("SMTP is not configured")
    message=EmailMessage()
    message["Subject"]="Reset your Intelligent Log Forensics password"
    message["From"]=SentinelSettings.SMTP_FROM
    message["To"]=recipient
    message.set_content("Use this secure password reset link within 30 minutes:\n" + SentinelSettings.APP_ORIGIN.rstrip("/") + "/reset-password?token=" + token + "\n\nIf you did not request this, no action is required.")
    with smtplib.SMTP(SentinelSettings.SMTP_HOST,SentinelSettings.SMTP_PORT,timeout=15) as smtp:
        smtp.starttls()
        if SentinelSettings.SMTP_USERNAME:
            smtp.login(SentinelSettings.SMTP_USERNAME,SentinelSettings.SMTP_PASSWORD or "")
        smtp.send_message(message)

def _password_is_valid(password):
    return len(password)>=10 and any(ch.isupper() for ch in password) and any(ch.islower() for ch in password) and any(ch.isdigit() for ch in password)

from aegis_core.security.identity import (
    issue_access_ticket,
    require_clearance,
    resolve_active_operator,
)

auth_blueprint = Blueprint("auth_views", __name__)
ops_blueprint = Blueprint("ops_views", __name__)
api_blueprint = Blueprint("api_views", __name__, url_prefix="/api/v1")


def gather_platform_telemetry() -> dict[str, Any]:
    with acquire_connection() as conn:
        total_signals = conn.execute("SELECT COUNT(*) c FROM telemetry_records").fetchone()["c"]
        total_threats = conn.execute("SELECT COUNT(*) c FROM threat_signals").fetchone()["c"]
        active_clusters = conn.execute("SELECT COUNT(*) c FROM incident_clusters WHERE cluster_disposition = 'Active'").fetchone()["c"]
        vault_items = conn.execute("SELECT COUNT(*) c FROM evidence_vault").fetchone()["c"]
        
        avg_threat = conn.execute("SELECT AVG(threat_magnitude) c FROM threat_signals").fetchone()["c"] or 0.0
        avg_fidelity = conn.execute("SELECT AVG(forensic_fidelity_rating) c FROM evidence_vault WHERE ingest_state = 'Indexed'").fetchone()["c"] or 95.0

        urgency_rows = conn.execute(
            "SELECT urgency_level, COUNT(*) c FROM threat_signals GROUP BY urgency_level"
        ).fetchall()
        urgency_map = {row["urgency_level"]: row["c"] for row in urgency_rows}

        recent_activity_rows = conn.execute(
            """
            SELECT 'Vault' AS category, original_filename AS title, ingest_state AS status_note, received_timestamp AS timestamp
            FROM evidence_vault
            UNION ALL
            SELECT 'Cluster' AS category, cluster_headline AS title, triage_severity AS status_note, opened_at AS timestamp
            FROM incident_clusters
            ORDER BY timestamp DESC LIMIT 8
            """
        ).fetchall()

        recent_dockets = conn.execute(
            "SELECT * FROM incident_clusters ORDER BY opened_at DESC LIMIT 6"
        ).fetchall()

    return {
        "total_signals": total_signals,
        "total_threats": total_threats,
        "active_clusters": active_clusters,
        "vault_bundles": vault_items,
        "average_threat_index": round(float(avg_threat), 1),
        "fidelity_rating": round(float(avg_fidelity), 1),
        "urgency_breakdown": urgency_map,
        "urgency_series": [
            urgency_map.get("Critical", 0),
            urgency_map.get("High", 0),
            urgency_map.get("Elevated", 0),
            urgency_map.get("Notice", 0),
        ],
        "recent_trail": [dict(r) for r in recent_activity_rows],
        "recent_dockets": [dict(r) for r in recent_dockets],
    }


# ==========================================
# AUTHENTICATION & IDENTITY ROUTES
# ==========================================

@auth_blueprint.route("/auth/portal", methods=["GET", "POST"])
def render_login_view():
    if request.method == "POST":
        email_cand = request.form.get("work_email", "").strip().lower() or request.form.get("email", "").strip().lower()
        pwd_cand = request.form.get("credential", "") or request.form.get("password", "")

        with acquire_connection() as conn:
            operator = conn.execute(
                "SELECT * FROM operators WHERE work_email = ?",
                (email_cand,)
            ).fetchone()

        if operator and operator["account_status"] == "active" and check_password_hash(operator["credential_hash"], pwd_cand):
            session.clear()
            session["active_operator_id"] = operator["operator_id"]
            with acquire_connection() as conn:
                now=SentinelSettings.get_current_utc_timestamp()
                conn.execute("UPDATE operators SET last_login_at=? WHERE operator_id=?",(now,operator["operator_id"]))
                _audit(conn,operator["operator_id"],"sign_in","operator",str(operator["operator_id"]))
            
            ticket = issue_access_ticket(operator["operator_id"], operator["clearance_tier"])
            resp = redirect(url_for("ops_views.render_command_deck"))
            resp.set_cookie(
                "aegis_session_token",
                ticket,
                httponly=True,
                samesite="Lax",
                secure=SentinelSettings.COOKIE_TRANSPORT_SECURITY,
                max_age=SentinelSettings.SESSION_LIFESPAN_SECONDS,
            )
            return resp

        flash("Authentication rejected: Invalid operator credentials.", "danger")

    return render_template("auth.html", mode="login")


@auth_blueprint.route("/auth/enlist", methods=["GET", "POST"])
def render_registration_view():
    if request.method == "POST":
        name = request.form.get("display_name", "").strip()
        email = request.form.get("work_email", "").strip().lower()
        password = request.form.get("credential", "")
        confirm_password = request.form.get("confirm_credential", "")

        errors = []

        if not name:
            errors.append("Display name is required.")

        if not email or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
            errors.append("Enter a valid email address.")

        if not _password_is_valid(password):
            errors.append("Password must be at least 10 characters and include uppercase, lowercase, and a number.")

        if password != confirm_password:
            errors.append("Passwords do not match.")

        if errors:
            for error in errors:
                flash(error, "danger")
            return render_template(
                "auth.html",
                mode="register",
                form_data={
                    "display_name": name,
                    "work_email": email,
                },
            )

        try:
            with acquire_connection() as conn:
                existing_user = conn.execute(
                    "SELECT operator_id FROM operators WHERE work_email = ?",
                    (email,),
                ).fetchone()

                if existing_user:
                    flash("An account with this email already exists.", "danger")
                    return render_template(
                        "auth.html",
                        mode="register",
                        form_data={
                            "display_name": name,
                            "work_email": email,
                        },
                    )

                conn.execute(
                    """
                    INSERT INTO operators (
                        display_name,
                        work_email,
                        credential_hash,
                        clearance_tier,
                        registered_at
                    )
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        name,
                        email,
                        generate_password_hash(password),
                        "Analyst",
                        SentinelSettings.get_current_utc_timestamp(),
                    ),
                )

            flash("Account created successfully. Please sign in.", "success")
            return redirect(url_for("auth_views.render_login_view"))

        except sqlite3.IntegrityError:
            flash("An account with this email already exists.", "danger")

        except Exception:
            current_app.logger.exception("User registration failed")
            flash("Unable to create the account. Please try again.", "danger")

    return render_template(
        "auth.html",
        mode="register",
        form_data={},
    )

@auth_blueprint.route("/auth/recovery", methods=["GET", "POST"])
def render_recovery_view():
    if request.method == "POST":
        email=request.form.get("work_email","").strip().lower() or request.form.get("email","").strip().lower()
        generic="If an account matches that address, a password reset message has been requested."
        try:
            with acquire_connection() as conn:
                operator=conn.execute("SELECT operator_id,work_email FROM operators WHERE work_email=? AND account_status='active'",(email,)).fetchone()
                if operator:
                    raw_token=secrets.token_urlsafe(32)
                    token_hash=hashlib.sha256(raw_token.encode()).hexdigest()
                    conn.execute("INSERT INTO password_reset_tokens(token_hash,operator_ref,expires_at,created_at) VALUES(?,?,?,?)",
                                 (token_hash,operator["operator_id"],int(time.time())+1800,SentinelSettings.get_current_utc_timestamp()))
                    _audit(conn,operator["operator_id"],"password_reset_requested","operator",str(operator["operator_id"]))
                    _send_reset_email(operator["work_email"],raw_token)
        except Exception:
            current_app.logger.exception("Password reset dispatch failed")
        flash(generic,"success")
    return render_template("auth.html", mode="recovery")

@auth_blueprint.route("/auth/reset-password", methods=["GET","POST"])
def render_reset_password_view():
    token=request.args.get("token","").strip() or request.form.get("token","").strip()
    if request.method=="GET":
        return render_template("auth.html",mode="reset",reset_token=token)
    password=request.form.get("password","")
    confirm=request.form.get("confirm_password","")
    if not _password_is_valid(password) or password!=confirm:
        flash("Choose a valid password and make sure both entries match.","danger")
        return render_template("auth.html",mode="reset",reset_token=token)
    token_hash=hashlib.sha256(token.encode()).hexdigest()
    try:
        with acquire_connection() as conn:
            row=conn.execute("SELECT operator_ref FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
                             (token_hash,int(time.time()))).fetchone()
            if not row:
                flash("This password reset link is invalid or expired.","danger")
                return render_template("auth.html",mode="reset",reset_token="")
            conn.execute("UPDATE operators SET credential_hash=? WHERE operator_id=?",(generate_password_hash(password),row["operator_ref"]))
            conn.execute("UPDATE password_reset_tokens SET used_at=? WHERE token_hash=?",(int(time.time()),token_hash))
            _audit(conn,row["operator_ref"],"password_reset_completed","operator",str(row["operator_ref"]))
        flash("Password updated. Please sign in.","success")
        return redirect(url_for("auth_views.render_login_view"))
    except Exception:
        current_app.logger.exception("Password reset failed")
        flash("Unable to complete password reset.","danger")
        return render_template("auth.html",mode="reset",reset_token=token)


@auth_blueprint.route("/auth/terminate")
def terminate_session():
    session.clear()
    resp = redirect(url_for("auth_views.render_login_view"))
    resp.delete_cookie("aegis_session_token")
    return resp


# ==========================================
# FORENSIC OPERATIONS COMMAND ROUTES
# ==========================================

@ops_blueprint.route("/")
def render_home_portal():
    operator = resolve_active_operator()
    telemetry = gather_platform_telemetry()

    return render_template(
        "index.html",
        telemetry=telemetry,
        metrics=telemetry,
        operator=operator,
    )

@ops_blueprint.route("/operations/deck")
@require_clearance("Analyst")
def render_command_deck():
    telem = gather_platform_telemetry()
    return render_template("dashboard.html", telemetry=telem, metrics=telem)


@ops_blueprint.route("/operations/ingest", methods=["GET", "POST"])
@require_clearance("Analyst")
def render_ingest_station():
    op = resolve_active_operator()
    if request.method == "POST":
        uploaded_file = request.files.get("evidence_stream") or request.files.get("evidence")
        if not uploaded_file or not uploaded_file.filename:
            flash("Evidence bundle is required. Select a valid telemetry file.", "danger")
            return redirect(url_for("ops_views.render_ingest_station"))

        clean_name = secure_filename(uploaded_file.filename)
        ext = clean_name.rsplit(".", 1)[-1].lower() if "." in clean_name else ""
        if ext not in SentinelSettings.PERMITTED_FORMATS:
            flash(f"Unsupported evidence format '.{ext}'. Supported: {', '.join(SentinelSettings.PERMITTED_FORMATS)}", "danger")
            return redirect(url_for("ops_views.render_ingest_station"))

        raw_payload = uploaded_file.read()
        digest = hashlib.sha256(raw_payload).hexdigest()
        descriptor = f"vault://bundles/{op.operator_id}/{digest[:16]}"
        received_ts = SentinelSettings.get_current_utc_timestamp()

        with acquire_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO evidence_vault (
                    operator_ref, original_filename, storage_descriptor,
                    digest_sha256, raw_payload, ingest_state, received_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (op.operator_id, clean_name, descriptor, digest, raw_payload, "Processing", received_ts),
            )
            vault_id = cursor.lastrowid

            try:
                # 1. Parse & Normalize signals
                signals = LogStreamTokenizer.parse_stream(raw_payload, clean_name)
                
                # 2. Batch persist signals
                for s in signals:
                    conn.execute(
                        """
                        INSERT INTO telemetry_records (
                            vault_ref, observed_epoch, origin_address, actor_identifier,
                            resource_target, action_verb, response_code, signal_classification,
                            log_excerpt, payload_blob
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        s.to_tuple(vault_id),
                    )

                # 3. Correlate with scikit-learn ML anomaly detection & rule signatures
                threat_count, cluster_count = correlate_and_persist_telemetry(conn, vault_id)

                # 4. Compute multi-factor fidelity rating
                records_dict = [
                    {"observed_epoch": s.observed_epoch, "origin_address": s.origin_address, "response_code": s.response_code}
                    for s in signals
                ]
                fidelity = calculate_fidelity_rating(records_dict, threat_count)

                # 5. Finalize vault record
                conn.execute(
                    """
                    UPDATE evidence_vault
                    SET ingest_state = 'Indexed', forensic_fidelity_rating = ?, ingested_count = ?
                    WHERE vault_id = ?
                    """,
                    (fidelity, len(signals), vault_id),
                )

                # 6. Post bulletin notification
                conn.execute(
                    """
                    INSERT INTO broadcast_bulletins (recipient_operator_ref, bulletin_body, urgency_marker, dispatched_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        op.operator_id,
                        f"Evidence '{clean_name}' indexed: {len(signals)} signals, {threat_count} threats, {cluster_count} dockets.",
                        "success" if threat_count == 0 else "warning",
                        SentinelSettings.get_current_utc_timestamp(),
                    ),
                )

                flash(f"Forensic indexing complete: {len(signals)} signals parsed, {threat_count} threats flagged ({cluster_count} dockets).", "success")
                return redirect(url_for("ops_views.render_vault_archive"))

            except Exception as exc:
                conn.execute(
                    "UPDATE evidence_vault SET ingest_state = 'Failed', diagnostic_trace = ? WHERE vault_id = ?",
                    (str(exc), vault_id),
                )
                conn.execute(
                    """
                    INSERT INTO broadcast_bulletins (recipient_operator_ref, bulletin_body, urgency_marker, dispatched_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (op.operator_id, f"Pipeline error on '{clean_name}': {exc}", "danger", SentinelSettings.get_current_utc_timestamp()),
                )
                flash(f"Forensic ingestion failed: {exc}", "danger")
                return redirect(url_for("ops_views.render_vault_archive"))

    return render_template("analyze.html")


@ops_blueprint.route("/operations/dockets")
@require_clearance("Analyst")
def render_dockets_queue():
    with acquire_connection() as conn:
        dockets = conn.execute(
            """
            SELECT c.cluster_id AS id, c.cluster_headline AS title, c.triage_severity AS severity,
                   c.attribution_confidence AS confidence, c.cluster_disposition AS status,
                   c.associated_technique AS technique_id, c.opened_at AS created_at,
                   v.original_filename
            FROM incident_clusters c
            JOIN evidence_vault v ON v.vault_id = c.vault_ref
            ORDER BY c.opened_at DESC
            """
        ).fetchall()
    return render_template("incidents.html", incidents=dockets)


@ops_blueprint.route("/operations/dockets/<int:docket_id>")
@require_clearance("Analyst")
def render_docket_investigation(docket_id: int):
    with acquire_connection() as conn:
        docket = conn.execute(
            """
            SELECT cluster_id AS id, cluster_headline AS title, triage_severity AS severity,
                   attribution_confidence AS confidence, causal_assessment AS root_cause,
                   associated_technique AS technique_id, vault_ref, opened_at AS created_at
            FROM incident_clusters WHERE cluster_id = ?
            """,
            (docket_id,)
        ).fetchone()

        if not docket:
            flash("Target threat docket not located.", "warning")
            return redirect(url_for("ops_views.render_dockets_queue"))

        timeline = conn.execute(
            """
            SELECT r.record_id AS id, r.observed_epoch AS timestamp, r.origin_address AS source_ip,
                   r.signal_classification AS event_type, r.log_excerpt AS message,
                   t.urgency_level AS severity, t.threat_magnitude AS score, t.forensic_hypothesis AS finding
            FROM telemetry_records r
            LEFT JOIN threat_signals t ON t.record_ref = r.record_id
            WHERE r.vault_ref = ?
            ORDER BY COALESCE(r.observed_epoch, r.record_id) ASC
            LIMIT 100
            """,
            (docket["vault_ref"],),
        ).fetchall()

    tech_spec = lookup_technique(docket["technique_id"])
    return render_template(
        "incident_detail.html",
        incident=docket,
        timeline=timeline,
        technique=tech_spec,
    )


@ops_blueprint.route("/operations/matrix")
@require_clearance("Analyst")
def render_mitre_matrix():
    with acquire_connection() as conn:
        counts_rows = conn.execute(
            """
            SELECT matrix_technique_ref, COUNT(*) c
            FROM threat_signals
            WHERE matrix_technique_ref IS NOT NULL
            GROUP BY matrix_technique_ref
            """
        ).fetchall()
        counts_map = {row["matrix_technique_ref"]: row["c"] for row in counts_rows}

    return render_template("mitre.html", counts=counts_map)


@ops_blueprint.route("/operations/playbooks")
@require_clearance("Analyst")
def render_remediation_playbooks():
    with acquire_connection() as conn:
        risks = conn.execute(
            """
            SELECT threat_domain AS category, matrix_technique_ref AS technique_id,
                   urgency_level AS severity, COUNT(*) AS c
            FROM threat_signals
            GROUP BY threat_domain, matrix_technique_ref, urgency_level
            ORDER BY c DESC
            """
        ).fetchall()
    return render_template("remediation.html", risks=risks)


@ops_blueprint.route("/operations/vault")
@require_clearance("Analyst")
def render_vault_archive():
    with acquire_connection() as conn:
        vault_items = conn.execute(
            """
            SELECT v.vault_id AS id, v.original_filename AS filename, v.ingest_state AS status,
                   v.ingested_count AS records_count, v.forensic_fidelity_rating AS quality_score,
                   v.received_timestamp AS created_at, v.diagnostic_trace AS error_message
            FROM evidence_vault v
            ORDER BY v.received_timestamp DESC
            """
        ).fetchall()
    return render_template("archive.html", uploads=vault_items)


@ops_blueprint.route("/operations/commander")
@require_clearance("Commander")
def render_commander_console():
    with acquire_connection() as conn:
        operators = conn.execute(
            "SELECT operator_id AS id, display_name AS name, work_email AS email, clearance_tier AS role, registered_at AS created_at FROM operators ORDER BY registered_at DESC"
        ).fetchall()
        recent_vault = conn.execute(
            """
            SELECT v.original_filename AS filename, v.ingest_state AS status,
                   v.ingested_count AS records_count, o.work_email AS email,
                   v.received_timestamp AS created_at
            FROM evidence_vault v
            JOIN operators o ON o.operator_id = v.operator_ref
            ORDER BY v.received_timestamp DESC LIMIT 15
            """
        ).fetchall()

    return render_template("admin.html", users=operators, uploads=recent_vault)


@ops_blueprint.route("/dossiers/investigation-brief.pdf")
@require_clearance("Analyst")
def download_forensic_dossier():
    summary = gather_platform_telemetry()
    pdf_bytes = compile_forensic_dossier_pdf(summary)
    
    resp = make_response(pdf_bytes)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = "attachment; filename=aegis-investigation-brief.pdf"
    return resp


@ops_blueprint.route("/reports/security-summary.pdf")
@require_clearance("Analyst")
def legacy_report_redirect():
    return redirect(url_for("ops_views.download_forensic_dossier"))


# ==========================================
# REST TELEMETRY APIS
# ==========================================

@api_blueprint.route("/telemetry/overview")
@require_clearance("Analyst")
def api_telemetry_overview():
    telemetry = gather_platform_telemetry()
    telemetry["total_logs"] = telemetry["total_signals"]
    telemetry["risk_events"] = telemetry["total_threats"]
    telemetry["incidents"] = telemetry["active_clusters"]
    telemetry["uploads"] = telemetry["vault_bundles"]
    telemetry["average_risk"] = telemetry["average_threat_index"]
    telemetry["chart"] = telemetry["urgency_series"]
    telemetry["recent"] = [
        {"kind": r["category"], "label": r["title"], "detail": r["status_note"], "created_at": r["timestamp"]}
        for r in telemetry["recent_trail"]
    ]
    return jsonify(telemetry)


@ops_blueprint.route("/api/dashboard")
@require_clearance("Analyst")
def legacy_api_dashboard():
    return redirect(url_for("api_views.api_telemetry_overview"))


@api_blueprint.route("/telemetry/announcements")
@require_clearance("Analyst")
def api_telemetry_announcements():
    op = resolve_active_operator()
    with acquire_connection() as conn:
        rows = conn.execute(
            """
            SELECT bulletin_id AS id, bulletin_body AS message, urgency_marker AS level, dispatched_at AS created_at
            FROM broadcast_bulletins
            WHERE recipient_operator_ref = ? AND acknowledged = 0
            ORDER BY dispatched_at DESC LIMIT 6
            """,
            (op.operator_id,),
        ).fetchall()
        
        conn.execute(
            "UPDATE broadcast_bulletins SET acknowledged = 1 WHERE recipient_operator_ref = ?",
            (op.operator_id,),
        )

    return jsonify([dict(r) for r in rows])


@api_blueprint.route("/ingest", methods=["POST"])
@require_clearance("Analyst")
def api_ingest_evidence():
    """Accept evidence from the browser without coupling the UI to redirects."""
    uploaded_file = request.files.get("evidence_stream") or request.files.get("evidence")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "Evidence bundle is required."}), 400

    clean_name = secure_filename(uploaded_file.filename)
    ext = clean_name.rsplit(".", 1)[-1].lower() if "." in clean_name else ""
    if ext not in SentinelSettings.PERMITTED_FORMATS:
        return jsonify({"error": f"Unsupported evidence format '.{ext}'."}), 415

    raw_payload = uploaded_file.read()
    op = resolve_active_operator()
    if not op:
        return jsonify({"error": "Operator credential validation required."}), 401

    digest = hashlib.sha256(raw_payload).hexdigest()
    descriptor = f"vault://bundles/{op.operator_id}/{digest[:16]}"
    received_ts = SentinelSettings.get_current_utc_timestamp()

    try:
        with acquire_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO evidence_vault (
                    operator_ref, original_filename, storage_descriptor,
                    digest_sha256, raw_payload, ingest_state, received_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (op.operator_id, clean_name, descriptor, digest, raw_payload, "Processing", received_ts),
            )
            vault_id = cursor.lastrowid
            signals = LogStreamTokenizer.parse_stream(raw_payload, clean_name)
            for signal in signals:
                conn.execute(
                    """
                    INSERT INTO telemetry_records (
                        vault_ref, observed_epoch, origin_address, actor_identifier,
                        resource_target, action_verb, response_code, signal_classification,
                        log_excerpt, payload_blob
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    signal.to_tuple(vault_id),
                )

            threat_count, cluster_count = correlate_and_persist_telemetry(conn, vault_id)
            fidelity = calculate_fidelity_rating(
                [
                    {
                        "observed_epoch": signal.observed_epoch,
                        "origin_address": signal.origin_address,
                        "response_code": signal.response_code,
                    }
                    for signal in signals
                ],
                threat_count,
            )
            conn.execute(
                """
                UPDATE evidence_vault
                SET ingest_state = 'Indexed', forensic_fidelity_rating = ?, ingested_count = ?
                WHERE vault_id = ?
                """,
                (fidelity, len(signals), vault_id),
            )
    except Exception as exc:
        current_app.logger.exception("Evidence API ingestion failed for %s", clean_name)
        return jsonify({"error": "Forensic ingestion failed. Review the upload status and server diagnostics."}), 500

    return jsonify(
        {
            "vault_id": vault_id,
            "filename": clean_name,
            "digest": digest,
            "records": len(signals),
            "threats": threat_count,
            "incidents": cluster_count,
            "fidelity": fidelity,
        }
    ), 201


@ops_blueprint.route("/api/notifications")
@require_clearance("Analyst")
def legacy_api_notifications():
    return redirect(url_for("api_views.api_telemetry_announcements"))


@api_blueprint.route("/telemetry/diagnostics")
@require_clearance("Analyst")
def api_telemetry_diagnostics():
    return jsonify({
        "subsystem_status": "nominal",
        "database_engine": "operational",
        "ml_inference_cluster": "synchronized",
        "timestamp_utc": SentinelSettings.get_current_utc_timestamp(),
    })


@api_blueprint.route("/telemetry/network-graph")
@require_clearance("Analyst")
def api_telemetry_network_graph():
    nodes = []
    edges = []
    node_registry = set()

    with acquire_connection() as conn:
        records = conn.execute(
            """
            SELECT origin_address, resource_target, signal_classification, response_code
            FROM telemetry_records
            WHERE origin_address IS NOT NULL
            LIMIT 60
            """
        ).fetchall()

        dockets = conn.execute(
            "SELECT cluster_id, cluster_headline, triage_severity, attribution_confidence FROM incident_clusters LIMIT 10"
        ).fetchall()

        threats = conn.execute(
            """
            SELECT t.threat_domain, t.urgency_level, t.threat_magnitude, r.origin_address
            FROM threat_signals t
            JOIN telemetry_records r ON r.record_id = t.record_ref
            LIMIT 40
            """
        ).fetchall()

    for r in records:
        ip = r["origin_address"]
        if ip and ip not in node_registry:
            node_registry.add(ip)
            nodes.append({"id": ip, "label": ip, "type": "origin_ip", "threat_level": "medium"})

        target = r["resource_target"]
        if target and target not in node_registry:
            node_registry.add(target)
            nodes.append({"id": target, "label": target, "type": "endpoint", "threat_level": "low"})

        if ip and target:
            edges.append({"source": ip, "target": target, "weight": 1})

    for d in dockets:
        d_id = f"docket_{d['cluster_id']}"
        if d_id not in node_registry:
            node_registry.add(d_id)
            nodes.append({
                "id": d_id,
                "label": d["cluster_headline"],
                "type": "docket",
                "threat_level": d["triage_severity"].lower(),
            })

    for t in threats:
        dom = t["threat_domain"]
        ip = t["origin_address"]
        if dom and dom not in node_registry:
            node_registry.add(dom)
            nodes.append({"id": dom, "label": dom, "type": "threat_domain", "threat_level": t["urgency_level"].lower()})
        if ip and dom:
            edges.append({"source": ip, "target": dom, "weight": 2})

    return jsonify({"nodes": nodes, "edges": edges})


@api_blueprint.route("/dashboard")
@require_clearance("Analyst")
def api_dashboard():
    return jsonify(gather_platform_telemetry())

@api_blueprint.route("/evidence", methods=["POST"])
@require_clearance("Analyst")
def api_evidence():
    return api_ingest_evidence()

@api_blueprint.route("/notifications")
@require_clearance("Analyst")
def api_notifications():
    return api_telemetry_announcements()

@api_blueprint.route("/system/health")
@require_clearance("Analyst")
def api_system_health():
    return jsonify({
        "status":"operational",
        "database":"operational",
        "analysis_engine":"operational",
        "timestamp_utc":SentinelSettings.get_current_utc_timestamp(),
    })

@api_blueprint.route("/mitre")
@require_clearance("Analyst")
def api_mitre():
    return jsonify({
        key:{
            "id":spec.technique_id,
            "name":spec.technique_label,
            "tactic":spec.tactic_domain,
            "markers":spec.behavioral_markers,
            "remediation":spec.remediation_playbook,
        } for key,spec in MITRE_ENTERPRISE_TAXONOMY.items()
    })

@api_blueprint.route("/incidents")
@require_clearance("Analyst")
def api_incidents():
    with acquire_connection() as conn:
        rows=conn.execute("""
            SELECT cluster_id AS id,cluster_headline AS title,triage_severity AS severity,
                   attribution_confidence AS confidence,cluster_disposition AS status,
                   associated_technique AS technique_id,opened_at AS created_at
            FROM incident_clusters ORDER BY opened_at DESC LIMIT 100
        """).fetchall()
    return jsonify([dict(row) for row in rows])
