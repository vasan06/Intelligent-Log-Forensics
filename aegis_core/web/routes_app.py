"""Main application routes"""
import hashlib
import json

from flask import (Blueprint, flash, jsonify, make_response, redirect,
                   render_template, request, session, url_for, current_app)
from werkzeug.utils import secure_filename

from aegis_core.analytics.correlator import correlate_and_persist_telemetry
from aegis_core.analytics.mitre_matrix import MITRE_TECHNIQUES, lookup_technique, get_all_tactics
from aegis_core.analytics.trust_engine import calculate_fidelity_rating
from aegis_core.config import Settings
from aegis_core.dossiers.generator import compile_forensic_dossier_pdf
from aegis_core.parsers.tokenizers import LogStreamTokenizer
from aegis_core.persistence.engine import get_db
from aegis_core.security.identity import get_current_user, login_required, admin_required

app_bp = Blueprint("app", __name__)


def _audit(user_id, action, detail=None, ip=None):
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO audit_log (user_id, action, detail, ip_address, created_at) VALUES (?,?,?,?,?)",
                (user_id, action, detail, ip, Settings.now_utc())
            )
    except Exception:
        pass


def _notify(user_id, message, level="info"):
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO notifications (user_id, message, level, created_at) VALUES (?,?,?,?)",
                (user_id, message, level, Settings.now_utc())
            )
    except Exception:
        pass


def _get_dashboard_stats(user_id=None, admin=False):
    with get_db() as conn:
        if admin:
            total_logs = conn.execute("SELECT COUNT(*) c FROM log_records").fetchone()["c"]
            total_threats = conn.execute("SELECT COUNT(*) c FROM threats").fetchone()["c"]
            active_incidents = conn.execute("SELECT COUNT(*) c FROM incidents WHERE status NOT IN ('resolved','closed')").fetchone()["c"]
            total_files = conn.execute("SELECT COUNT(*) c FROM log_files WHERE status = 'indexed'").fetchone()["c"]
            total_users = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
            critical_count = conn.execute("SELECT COUNT(*) c FROM threats WHERE severity = 'Critical'").fetchone()["c"]
        else:
            total_logs = conn.execute("SELECT COUNT(*) c FROM log_records r JOIN log_files f ON f.file_id = r.file_id WHERE f.user_id = ?", (user_id,)).fetchone()["c"]
            total_threats = conn.execute("SELECT COUNT(*) c FROM threats t JOIN log_files f ON f.file_id = t.file_id WHERE f.user_id = ?", (user_id,)).fetchone()["c"]
            active_incidents = conn.execute("SELECT COUNT(*) c FROM incidents i JOIN log_files f ON f.file_id = i.file_id WHERE f.user_id = ? AND i.status NOT IN ('resolved','closed')", (user_id,)).fetchone()["c"]
            total_files = conn.execute("SELECT COUNT(*) c FROM log_files WHERE user_id = ? AND status = 'indexed'", (user_id,)).fetchone()["c"]
            total_users = None
            critical_count = conn.execute("SELECT COUNT(*) c FROM threats t JOIN log_files f ON f.file_id = t.file_id WHERE f.user_id = ? AND t.severity = 'Critical'", (user_id,)).fetchone()["c"]

        severity_rows = conn.execute(
            "SELECT severity, COUNT(*) c FROM threats GROUP BY severity"
        ).fetchall()
        severity_map = {r["severity"]: r["c"] for r in severity_rows}

        avg_score = conn.execute("SELECT AVG(score) c FROM threats").fetchone()["c"] or 0

        recent_incidents = conn.execute(
            """SELECT i.incident_id, i.title, i.severity, i.status, i.created_at,
                      f.filename
               FROM incidents i JOIN log_files f ON f.file_id = i.file_id
               ORDER BY i.created_at DESC LIMIT 5"""
        ).fetchall()

        recent_files = conn.execute(
            """SELECT file_id, filename, status, record_count, threat_count, uploaded_at
               FROM log_files ORDER BY uploaded_at DESC LIMIT 5"""
        ).fetchall()

    return {
        "total_logs": total_logs,
        "total_threats": total_threats,
        "active_incidents": active_incidents,
        "total_files": total_files,
        "total_users": total_users,
        "critical_count": critical_count,
        "severity_map": severity_map,
        "avg_threat_score": round(float(avg_score), 1),
        "recent_incidents": [dict(r) for r in recent_incidents],
        "recent_files": [dict(r) for r in recent_files],
    }


# ── Landing Page ──────────────────────────────────────────────────────────────

@app_bp.route("/")
def index():
    user = get_current_user()
    stats = {}
    try:
        with get_db() as conn:
            stats["total_logs"] = conn.execute("SELECT COUNT(*) c FROM log_records").fetchone()["c"]
            stats["total_files"] = conn.execute("SELECT COUNT(*) c FROM log_files").fetchone()["c"]
            stats["total_threats"] = conn.execute("SELECT COUNT(*) c FROM threats").fetchone()["c"]
            stats["total_incidents"] = conn.execute("SELECT COUNT(*) c FROM incidents").fetchone()["c"]
    except Exception:
        pass
    return render_template("index.html", user=user, stats=stats)


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app_bp.route("/dashboard")
@login_required
def dashboard():
    user = get_current_user()
    stats = _get_dashboard_stats(user.user_id, admin=user.is_admin)
    return render_template("app/dashboard.html", user=user, stats=stats)


# ── Upload ────────────────────────────────────────────────────────────────────

@app_bp.route("/upload", methods=["GET", "POST"])
@login_required
def upload():
    user = get_current_user()

    if request.method == "POST":
        f = request.files.get("log_file")
        if not f or not f.filename:
            flash("Please select a log file to upload.", "error")
            return redirect(url_for("app.upload"))

        name = secure_filename(f.filename)
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if ext not in Settings.ALLOWED_EXTENSIONS:
            flash(f"Unsupported file type '.{ext}'. Allowed: {', '.join(Settings.ALLOWED_EXTENSIONS)}", "error")
            return redirect(url_for("app.upload"))

        raw = f.read()
        sha256 = hashlib.sha256(raw).hexdigest()
        size = len(raw)

        with get_db() as conn:
            cursor = conn.execute(
                """INSERT INTO log_files (user_id, filename, file_size, file_ext, sha256, status, uploaded_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (user.user_id, name, size, ext, sha256, "processing", Settings.now_utc())
            )
            file_id = cursor.lastrowid

            try:
                signals = LogStreamTokenizer.parse_stream(raw, name)
                for s in signals:
                    conn.execute(
                        """INSERT INTO log_records
                           (file_id, timestamp, source_ip, user_agent, resource, method,
                            status_code, event_type, message, raw_line)
                           VALUES (?,?,?,?,?,?,?,?,?,?)""",
                        (file_id, s.observed_epoch, s.origin_address, s.actor_identifier,
                         s.resource_target, s.action_verb, s.response_code,
                         s.signal_classification, s.log_excerpt,
                         s.payload_blob[:2000] if s.payload_blob else "")
                    )

                threat_count, incident_count = correlate_and_persist_telemetry(conn, file_id)
                quality = calculate_fidelity_rating(
                    [{"observed_epoch": s.observed_epoch, "origin_address": s.origin_address,
                      "response_code": s.response_code} for s in signals],
                    threat_count
                )

                conn.execute(
                    """UPDATE log_files SET status='indexed', record_count=?, threat_count=?,
                       incident_count=?, quality_score=? WHERE file_id=?""",
                    (len(signals), threat_count, incident_count, quality, file_id)
                )

                _notify(user.user_id,
                        f"File '{name}' analyzed: {len(signals)} records, {threat_count} threats detected.",
                        "warning" if threat_count > 0 else "success")
                _audit(user.user_id, "file_upload",
                       f"Uploaded {name}: {len(signals)} records, {threat_count} threats", request.remote_addr)

                flash(f"Analysis complete: {len(signals)} log records, {threat_count} threats detected.", "success")
                return redirect(url_for("app.analyze", file_id=file_id))

            except Exception as exc:
                current_app.logger.exception("Processing failed for %s", name)
                conn.execute(
                    "UPDATE log_files SET status='failed', error_message=? WHERE file_id=?",
                    (str(exc), file_id)
                )
                flash(f"Processing failed: {exc}", "error")
                return redirect(url_for("app.uploads"))

    with get_db() as conn:
        recent = conn.execute(
            """SELECT file_id, filename, file_size, status, record_count, threat_count, uploaded_at
               FROM log_files WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 10""",
            (user.user_id,)
        ).fetchall()

    return render_template("app/upload.html", user=user, recent_files=[dict(r) for r in recent])


# ── Uploads Archive ───────────────────────────────────────────────────────────

@app_bp.route("/uploads")
@login_required
def uploads():
    user = get_current_user()
    with get_db() as conn:
        files = conn.execute(
            """SELECT file_id, filename, file_size, file_ext, status, record_count,
                      threat_count, incident_count, quality_score, uploaded_at, error_message
               FROM log_files WHERE user_id = ? ORDER BY uploaded_at DESC""",
            (user.user_id,)
        ).fetchall()
    return render_template("app/uploads.html", user=user, files=[dict(f) for f in files])


# ── Analysis ──────────────────────────────────────────────────────────────────

@app_bp.route("/analyze")
@app_bp.route("/analyze/<int:file_id>")
@login_required
def analyze(file_id: int | None = None):
    user = get_current_user()

    with get_db() as conn:
        user_files = conn.execute(
            "SELECT file_id, filename, status, record_count FROM log_files WHERE user_id = ? AND status = 'indexed' ORDER BY uploaded_at DESC",
            (user.user_id,)
        ).fetchall()

        selected_file = None
        records = []
        threats = []

        if file_id:
            selected_file = conn.execute(
                "SELECT * FROM log_files WHERE file_id = ? AND user_id = ?",
                (file_id, user.user_id)
            ).fetchone()

            if selected_file:
                severity = request.args.get("severity", "")
                search = request.args.get("q", "")
                page = max(1, int(request.args.get("page", 1)))
                per_page = 50

                query = "SELECT * FROM log_records WHERE file_id = ?"
                params = [file_id]
                if severity:
                    pass  # We'll filter by joined threat severity
                if search:
                    query += " AND (message LIKE ? OR source_ip LIKE ? OR raw_line LIKE ?)"
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
                query += f" ORDER BY record_id ASC LIMIT {per_page} OFFSET {(page-1)*per_page}"

                records = conn.execute(query, params).fetchall()
                threats = conn.execute(
                    """SELECT t.*, r.source_ip, r.resource, r.timestamp
                       FROM threats t LEFT JOIN log_records r ON r.record_id = t.record_id
                       WHERE t.file_id = ? ORDER BY t.score DESC LIMIT 100""",
                    (file_id,)
                ).fetchall()

    return render_template("app/analyze.html",
                           user=user,
                           user_files=[dict(f) for f in user_files],
                           selected_file=dict(selected_file) if selected_file else None,
                           records=[dict(r) for r in records],
                           threats=[dict(t) for t in threats],
                           file_id=file_id,
                           search=request.args.get("q", ""),
                           severity_filter=request.args.get("severity", ""))


# ── MITRE Mapping ─────────────────────────────────────────────────────────────

@app_bp.route("/mitre")
@app_bp.route("/mitre/<int:file_id>")
@login_required
def mitre(file_id: int | None = None):
    user = get_current_user()

    with get_db() as conn:
        # Technique counts from actual detections
        counts_rows = conn.execute(
            """SELECT t.technique_id, COUNT(*) c
               FROM threats t JOIN log_files f ON f.file_id = t.file_id
               WHERE f.user_id = ? AND t.technique_id IS NOT NULL
               GROUP BY t.technique_id""",
            (user.user_id,)
        ).fetchall()
        counts = {r["technique_id"]: r["c"] for r in counts_rows}

        user_files = conn.execute(
            "SELECT file_id, filename FROM log_files WHERE user_id = ? AND status = 'indexed' ORDER BY uploaded_at DESC",
            (user.user_id,)
        ).fetchall()

    tactics = get_all_tactics()
    return render_template("app/mitre.html",
                           user=user,
                           mitre_techniques=MITRE_TECHNIQUES,
                           counts=counts,
                           tactics=tactics,
                           user_files=[dict(f) for f in user_files])


# ── ML Score ──────────────────────────────────────────────────────────────────

@app_bp.route("/ml-analysis")
@app_bp.route("/ml-analysis/<int:file_id>")
@login_required
def ml_analysis(file_id: int | None = None):
    user = get_current_user()

    with get_db() as conn:
        user_files = conn.execute(
            "SELECT file_id, filename, status FROM log_files WHERE user_id = ? AND status = 'indexed' ORDER BY uploaded_at DESC",
            (user.user_id,)
        ).fetchall()

        ml_data = None
        if file_id:
            file_rec = conn.execute(
                "SELECT * FROM log_files WHERE file_id = ? AND user_id = ?",
                (file_id, user.user_id)
            ).fetchone()

            if file_rec:
                threat_stats = conn.execute(
                    """SELECT AVG(score) avg_score, AVG(ml_score) avg_ml,
                              AVG(confidence) avg_conf, MAX(score) max_score,
                              COUNT(*) total
                       FROM threats WHERE file_id = ?""",
                    (file_id,)
                ).fetchone()

                top_threats = conn.execute(
                    """SELECT t.severity, t.score, t.ml_score, t.category,
                              t.technique_id, t.finding, t.confidence, t.detected_at,
                              r.source_ip, r.resource
                       FROM threats t LEFT JOIN log_records r ON r.record_id = t.record_id
                       WHERE t.file_id = ? ORDER BY t.score DESC LIMIT 20""",
                    (file_id,)
                ).fetchall()

                severity_dist = conn.execute(
                    "SELECT severity, COUNT(*) c FROM threats WHERE file_id = ? GROUP BY severity",
                    (file_id,)
                ).fetchall()

                ml_data = {
                    "file": dict(file_rec),
                    "stats": dict(threat_stats) if threat_stats else {},
                    "top_threats": [dict(t) for t in top_threats],
                    "severity_dist": {r["severity"]: r["c"] for r in severity_dist},
                }

    return render_template("app/ml_analysis.html",
                           user=user,
                           user_files=[dict(f) for f in user_files],
                           ml_data=ml_data,
                           file_id=file_id)


# ── Reports ───────────────────────────────────────────────────────────────────

@app_bp.route("/reports")
@login_required
def reports():
    user = get_current_user()
    with get_db() as conn:
        report_list = conn.execute(
            """SELECT r.report_id, r.title, r.report_type, r.status, r.created_at,
                      f.filename
               FROM reports r LEFT JOIN log_files f ON f.file_id = r.file_id
               WHERE r.user_id = ? ORDER BY r.created_at DESC""",
            (user.user_id,)
        ).fetchall()
        user_files = conn.execute(
            "SELECT file_id, filename FROM log_files WHERE user_id = ? AND status = 'indexed' ORDER BY uploaded_at DESC",
            (user.user_id,)
        ).fetchall()
    return render_template("app/reports.html",
                           user=user,
                           reports=[dict(r) for r in report_list],
                           user_files=[dict(f) for f in user_files])


@app_bp.route("/reports/generate", methods=["POST"])
@login_required
def generate_report():
    user = get_current_user()
    file_id = request.form.get("file_id", type=int)
    report_type = request.form.get("report_type", "full")

    with get_db() as conn:
        stats = _get_dashboard_stats(user.user_id)
        if file_id:
            file_rec = conn.execute(
                "SELECT * FROM log_files WHERE file_id = ? AND user_id = ?",
                (file_id, user.user_id)
            ).fetchone()
            if file_rec:
                stats["file"] = dict(file_rec)
                stats["threats_detail"] = [dict(t) for t in conn.execute(
                    "SELECT * FROM threats WHERE file_id = ? ORDER BY score DESC LIMIT 50",
                    (file_id,)
                ).fetchall()]

    pdf_bytes = compile_forensic_dossier_pdf(stats)

    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO reports (user_id, file_id, title, report_type, status, created_at) VALUES (?,?,?,?,?,?)",
            (user.user_id, file_id, f"Security Report — {Settings.now_display()}", report_type, "generated", Settings.now_utc())
        )
    _audit(user.user_id, "report_generated", f"Report for file_id={file_id}", request.remote_addr)
    _notify(user.user_id, "Security report generated and ready to download.", "success")

    resp = make_response(pdf_bytes)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = "attachment; filename=ilf-security-report.pdf"
    return resp


# ── Live Simulator ────────────────────────────────────────────────────────────

@app_bp.route("/simulator")
@login_required
def simulator():
    user = get_current_user()
    return render_template("app/simulator.html", user=user)


# ── Incidents ─────────────────────────────────────────────────────────────────

@app_bp.route("/incidents")
@login_required
def incidents():
    user = get_current_user()
    status_filter = request.args.get("status", "")
    severity_filter = request.args.get("severity", "")

    with get_db() as conn:
        query = """
            SELECT i.incident_id, i.title, i.severity, i.status, i.category,
                   i.technique_id, i.confidence, i.created_at, i.updated_at,
                   f.filename
            FROM incidents i JOIN log_files f ON f.file_id = i.file_id
            WHERE f.user_id = ?
        """
        params = [user.user_id]
        if status_filter:
            query += " AND i.status = ?"
            params.append(status_filter)
        if severity_filter:
            query += " AND i.severity = ?"
            params.append(severity_filter)
        query += " ORDER BY i.created_at DESC"
        incident_list = conn.execute(query, params).fetchall()

    return render_template("app/incidents.html",
                           user=user,
                           incidents=[dict(i) for i in incident_list],
                           status_filter=status_filter,
                           severity_filter=severity_filter)


@app_bp.route("/incidents/<int:incident_id>")
@login_required
def incident_detail(incident_id: int):
    user = get_current_user()
    with get_db() as conn:
        incident = conn.execute(
            """SELECT i.*, f.filename FROM incidents i
               JOIN log_files f ON f.file_id = i.file_id
               WHERE i.incident_id = ? AND f.user_id = ?""",
            (incident_id, user.user_id)
        ).fetchone()

        if not incident:
            flash("Incident not found.", "error")
            return redirect(url_for("app.incidents"))

        timeline = conn.execute(
            """SELECT r.record_id, r.timestamp, r.source_ip, r.event_type,
                      r.message, t.severity, t.score, t.finding
               FROM log_records r
               LEFT JOIN threats t ON t.record_id = r.record_id
               WHERE r.file_id = ?
               ORDER BY r.record_id ASC LIMIT 100""",
            (incident["file_id"],)
        ).fetchall()

    technique = lookup_technique(incident["technique_id"])
    return render_template("app/incident_detail.html",
                           user=user,
                           incident=dict(incident),
                           timeline=[dict(t) for t in timeline],
                           technique=technique)


@app_bp.route("/incidents/<int:incident_id>/update", methods=["POST"])
@login_required
def update_incident(incident_id: int):
    user = get_current_user()
    new_status = request.form.get("status")
    notes = request.form.get("notes", "")

    valid_statuses = ["new", "investigating", "confirmed", "resolved", "closed"]
    if new_status not in valid_statuses:
        flash("Invalid status.", "error")
        return redirect(url_for("app.incident_detail", incident_id=incident_id))

    with get_db() as conn:
        inc = conn.execute(
            "SELECT i.incident_id FROM incidents i JOIN log_files f ON f.file_id = i.file_id WHERE i.incident_id = ? AND f.user_id = ?",
            (incident_id, user.user_id)
        ).fetchone()
        if not inc:
            flash("Incident not found.", "error")
            return redirect(url_for("app.incidents"))

        conn.execute(
            "UPDATE incidents SET status = ?, notes = ?, updated_at = ? WHERE incident_id = ?",
            (new_status, notes, Settings.now_utc(), incident_id)
        )

    _audit(user.user_id, "incident_update", f"Incident #{incident_id} → {new_status}", request.remote_addr)
    flash(f"Incident status updated to '{new_status}'.", "success")
    return redirect(url_for("app.incident_detail", incident_id=incident_id))


# ── Profile ───────────────────────────────────────────────────────────────────

@app_bp.route("/profile")
@login_required
def profile():
    user = get_current_user()
    with get_db() as conn:
        activity = conn.execute(
            "SELECT action, detail, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
            (user.user_id,)
        ).fetchall()
    return render_template("app/profile.html", user=user, activity=[dict(a) for a in activity])


@app_bp.route("/profile/update", methods=["POST"])
@login_required
def update_profile():
    user = get_current_user()
    name = request.form.get("name", "").strip()
    if name and len(name) >= 2:
        with get_db() as conn:
            conn.execute("UPDATE users SET name = ? WHERE user_id = ?", (name, user.user_id))
        flash("Profile updated.", "success")
    else:
        flash("Name must be at least 2 characters.", "error")
    return redirect(url_for("app.profile"))


# ── Notifications ─────────────────────────────────────────────────────────────

@app_bp.route("/notifications")
@login_required
def notifications():
    user = get_current_user()
    with get_db() as conn:
        notifs = conn.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user.user_id,)
        ).fetchall()
        conn.execute("UPDATE notifications SET read = 1 WHERE user_id = ?", (user.user_id,))
    return render_template("app/notifications.html", user=user, notifications=[dict(n) for n in notifs])
