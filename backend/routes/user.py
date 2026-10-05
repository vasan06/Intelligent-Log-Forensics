"""
routes/user.py — Real user profile, dynamic database activity metrics, password update, and styled PDF export
"""

import io
import datetime
import jwt
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import select, update, func, desc

import bcrypt
from backend.database import get_db
from backend.models.user import users
from backend.models.uploaded_file import uploaded_files
from backend.models.log_analysis import log_analyses
from backend.models.report import reports
from backend.config import JWT_SECRET_KEY, JWT_ALGORITHM

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

user_bp = Blueprint("user", __name__)


def get_authenticated_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        with get_db() as db:
            exists = db.execute(select(users.c.id).where(users.c.id == str(user_id), users.c.verified.is_(True))).first()
        return user_id if exists else None
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def safe_user(user):
    name = user["name"] or ""
    initials = "".join(word[0] for word in name.split() if word)[:2].upper()
    return {
        "id": str(user["id"]),
        "name": name,
        "email": user["email"],
        "role": user["role"],
        "avatar": initials,
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None
    }


def get_user_real_metrics(user_id):
    """Calculates live activity counts from PostgreSQL for this user."""
    with get_db() as db:
        # Uploaded files
        file_rows = db.execute(
            select(uploaded_files.c.id, uploaded_files.c.filename, uploaded_files.c.size, uploaded_files.c.created_at)
            .where(uploaded_files.c.user_id == str(user_id))
            .order_by(uploaded_files.c.created_at.desc())
        ).mappings().all()

        # Analyses and threat simulations
        analysis_rows = db.execute(
            select(log_analyses.c.id, log_analyses.c.file_id, log_analyses.c.results, log_analyses.c.created_at)
            .where(log_analyses.c.user_id == str(user_id))
            .order_by(log_analyses.c.created_at.desc())
        ).mappings().all()

        # Reports
        report_rows = db.execute(
            select(reports.c.id, reports.c.report_type, reports.c.created_at)
            .where(reports.c.user_id == str(user_id))
            .order_by(reports.c.created_at.desc())
        ).mappings().all()

    total_files = len(file_rows)
    total_analyses = len(analysis_rows)
    total_reports = len(report_rows)

    total_logs = 0
    threats_detected = 0

    # Deduplicate analyses: keep latest analysis per uploaded file + distinct simulations
    deduped_analyses = []
    seen_fids = set()
    for a in analysis_rows:
        fid = a.get("file_id")
        res = a.get("results") or {}
        if not isinstance(res, dict):
            res = {}
        if res.get("stream_batch") is True and res.get("source") == "live_stream":
            continue
        if fid:
            fid_str = str(fid)
            if fid_str in seen_fids:
                continue
            seen_fids.add(fid_str)
            deduped_analyses.append(a)
        else:
            deduped_analyses.append(a)

    analyzed_fids = set()
    for a in deduped_analyses:
        fid = a.get("file_id")
        if fid:
            analyzed_fids.add(str(fid))
        res = a.get("results") or {}
        raw_logs = res.get("logs") or res.get("preview") or []
        row_logs = len(raw_logs) or int(res.get("total_logs") or res.get("lines_parsed") or 0)
        total_logs += row_logs

        anom = int(res.get("anomalies") or res.get("anomalies_found") or len(res.get("flagged_entries", [])) or 0)
        if anom == 0:
            ml_obj = res.get("ml") or res.get("ml_analysis") or {}
            anom = len(ml_obj.get("flagged_entries", []))
            if not anom and ml_obj.get("risk_level") in ["HIGH", "CRITICAL"]:
                anom = 1
        threats_detected += anom

    # Add any uploaded files not yet analyzed
    for f in file_rows:
        if str(f["id"]) not in analyzed_fids:
            total_logs += max(int(f.get("size") or 0) // 80, 1)

    # Build chronological feed
    events = []
    for f in file_rows[:5]:
        events.append({
            "type": "upload",
            "title": f"Uploaded file: {f['filename']}",
            "detail": f"{(f.get('size', 0) // 80) or 1} lines ingested into PostgreSQL",
            "time": f["created_at"].isoformat() if f["created_at"] else None,
            "badge": "INFO",
            "raw_time": f["created_at"]
        })

    for a in analysis_rows[:8]:
        res = a.get("results") or {}
        ml_obj = res.get("ml") or res.get("ml_analysis") or {}
        risk_level = ml_obj.get("risk_level", "LOW")
        algo_name = ml_obj.get("best_algorithm", "Consensus Ensemble")
        is_sim = res.get("is_simulation", False)
        if is_sim:
            sim_name = res.get("simulation_name", "Threat Simulation")
            events.append({
                "type": "simulation",
                "title": f"Threat Simulation: {sim_name}",
                "detail": f"Classified at {risk_level} risk level",
                "time": a["created_at"].isoformat() if a["created_at"] else None,
                "badge": risk_level,
                "raw_time": a["created_at"]
            })
        else:
            events.append({
                "type": "ml_analysis",
                "title": f"Ran ML Ensemble Analysis ({algo_name})",
                "detail": f"Resulted in {risk_level} Risk ({res.get('anomalies_found', 0)} anomalies)",
                "time": a["created_at"].isoformat() if a["created_at"] else None,
                "badge": risk_level,
                "raw_time": a["created_at"]
            })

    for r in report_rows[:5]:
        events.append({
            "type": "report",
            "title": f"Generated Executive PDF Report",
            "detail": f"Archived to PostgreSQL BLOB storage",
            "time": r["created_at"].isoformat() if r["created_at"] else None,
            "badge": "SUCCESS",
            "raw_time": r["created_at"]
        })

    # Sort events by timestamp desc
    events.sort(key=lambda x: x["raw_time"] or datetime.datetime.min.replace(tzinfo=datetime.timezone.utc), reverse=True)
    for e in events:
        e.pop("raw_time", None)

    return {
        "stats": {
            "analyses_run": total_analyses,
            "logs_processed": total_logs,
            "threats_caught": threats_detected,
            "reports_generated": total_reports,
            "files_uploaded": total_files,
        },
        "recent_activity": events[:10]
    }


@user_bp.route("/user/profile", methods=["GET"])
def get_profile():
    user_id = get_authenticated_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(user_id))).mappings().first()

    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    metrics = get_user_real_metrics(user_id)

    return jsonify({
        "success": True,
        "user": safe_user(user),
        "stats": metrics["stats"],
        "recent_activity": metrics["recent_activity"]
    }), 200


@user_bp.route("/user/profile", methods=["PUT"])
def update_profile():
    user_id = get_authenticated_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()

    values = {}
    if name:
        values["name"] = name
    if email:
        values["email"] = email

    if not values:
        return jsonify({"success": False, "message": "No profile changes supplied"}), 400

    with get_db() as db:
        if "email" in values:
            existing = db.execute(
                select(users).where(users.c.email == values["email"], users.c.id != str(user_id))
            ).mappings().first()
            if existing:
                return jsonify({"success": False, "message": "An account with this email already exists"}), 409

        db.execute(update(users).where(users.c.id == str(user_id)).values(**values))
        user = db.execute(select(users).where(users.c.id == str(user_id))).mappings().first()

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "user": safe_user(user),
    }), 200


@user_bp.route("/user/password", methods=["PUT"])
def update_password():
    user_id = get_authenticated_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    curr_pw = data.get("current_password") or ""
    new_pw = data.get("new_password") or ""

    if not curr_pw or not new_pw:
        return jsonify({"success": False, "message": "Current and new password are required"}), 400

    if len(new_pw) < 6:
        return jsonify({"success": False, "message": "New password must be at least 6 characters"}), 400

    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(user_id))).mappings().first()
        if not user or not verify_password(curr_pw, user["password_hash"]):
            return jsonify({"success": False, "message": "Incorrect current password"}), 400

        new_hash = hash_password(new_pw)
        db.execute(update(users).where(users.c.id == str(user_id)).values(password_hash=new_hash))

    return jsonify({"success": True, "message": "Password updated successfully"}), 200


@user_bp.route("/user/export", methods=["GET"])
def export_user_data():
    user_id = get_authenticated_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    metrics = get_user_real_metrics(user_id)
    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(user_id))).mappings().first()

    return jsonify({
        "success": True,
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "user": safe_user(user),
        "metrics": metrics["stats"],
        "activity_history": metrics["recent_activity"],
    })


@user_bp.route("/user/export-pdf", methods=["GET"])
def export_user_pdf():
    user_id = get_authenticated_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(user_id))).mappings().first()

    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    metrics = get_user_real_metrics(user_id)
    stats = metrics["stats"]
    activity = metrics["recent_activity"]

    try:
        from reportlab.lib import colors
        from reportlab.lib.colors import HexColor
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    except ImportError:
        return jsonify({"success": False, "message": "ReportLab not installed"}), 500

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=38, rightMargin=38, topMargin=38, bottomMargin=38)
    styles = getSampleStyleSheet()

    c_primary = HexColor("#2D2B6B")
    c_accent  = HexColor("#6366F1")
    c_muted   = HexColor("#64748B")
    c_text    = HexColor("#1E293B")

    title_style = ParagraphStyle("T", parent=styles["Heading1"], fontSize=20, textColor=c_primary, fontName="Helvetica-Bold", spaceAfter=2)
    sub_style   = ParagraphStyle("S", parent=styles["Normal"], fontSize=9, textColor=c_muted, fontName="Helvetica", spaceAfter=14)
    sec_style   = ParagraphStyle("H", parent=styles["Heading2"], fontSize=12, textColor=c_primary, fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=6)
    body_style  = ParagraphStyle("B", parent=styles["BodyText"], fontSize=8.5, textColor=c_text, fontName="Helvetica", leading=12)

    story = [
        Paragraph("Intelligent Log Forensic", title_style),
        Paragraph(f"Official User Profile & Forensic Audit Dossier — {user['name']}", ParagraphStyle("SubH", parent=styles["Heading3"], fontSize=12, textColor=c_accent, spaceAfter=2)),
        Paragraph(f"Exported on {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} | Authorized Role: {user['role']}", sub_style),
        HRFlowable(width="100%", thickness=1, color=HexColor("#E2E8F0"), spaceAfter=12),
        Paragraph("User Identification & Access Credentials", sec_style),
    ]

    id_data = [
        ["User Full Name", user["name"] or "N/A"],
        ["Registered Email", user["email"] or "N/A"],
        ["Assigned System Role", user["role"] or "User"],
        ["Account Identifier (UUID)", str(user["id"])],
        ["Verified Status", "Verified Active Member"],
        ["Organisation", "Intelligent Log Forensic Security Operation"],
    ]
    id_table = Table(id_data, colWidths=[180, 340])
    id_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), HexColor("#F1F5F9")),
        ("TEXTCOLOR", (0, 0), (0, -1), c_muted),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(id_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Forensic Activity Metrics (Database Aggregation)", sec_style))
    stat_data = [
        ["Analyses Run", "Total Logs Processed", "Threats Caught", "Reports Generated", "Files Ingested"],
        [f"{stats['analyses_run']:,}", f"{stats['logs_processed']:,}", f"{stats['threats_caught']:,}", f"{stats['reports_generated']:,}", f"{stats['files_uploaded']:,}"]
    ]
    stat_table = Table(stat_data, colWidths=[104, 104, 104, 104, 104])
    stat_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("TEXTCOLOR", (0, 1), (-1, 1), c_text),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 11),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Recent Forensic Activities & Threat Investigations", sec_style))
    if activity:
        act_rows = [["Time", "Type", "Investigation Event", "Risk Level / Outcome"]]
        for a in activity[:12]:
            act_rows.append([
                (a.get("time") or "")[:19].replace("T", " "),
                a.get("type", "").replace("_", " ").upper(),
                a.get("title", "")[:50],
                a.get("badge", "INFO")
            ])
        act_table = Table(act_rows, colWidths=[105, 80, 255, 80])
        act_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), c_muted),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#F8FAFC")]),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(act_table)
    else:
        story.append(Paragraph("No forensic activities recorded yet.", body_style))

    doc.build(story)
    buf.seek(0)
    return send_file(
        buf,
        as_attachment=True,
        download_name=f"ILF_Profile_Dossier_{user['name'].replace(' ', '_')}.pdf",
        mimetype="application/pdf"
    )
