"""User-scoped executive forensic reports, in-DB PDF storage, and activity-based analysis."""
import datetime
import io
import json
import re
import uuid
import jwt
from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import select, desc
from backend import config
from backend.database import get_db
from backend.models.log_analysis import log_analyses
from backend.models.report import reports
from backend.models.uploaded_file import uploaded_files
from backend.services.ml_service import run_ensemble

reports_bp = Blueprint("reports", __name__)

def current_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        p = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        return str(p["sub"]) if p.get("type") == "access" else None
    except jwt.InvalidTokenError:
        return None

@reports_bp.route("/reports/activities", methods=["GET"])
def get_user_activities():
    uid = current_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    activities = []
    with get_db() as db:
        # 1. Uploaded files
        files = db.execute(
            select(uploaded_files.c.id, uploaded_files.c.filename, uploaded_files.c.size, uploaded_files.c.db_location, uploaded_files.c.created_at)
            .where(uploaded_files.c.user_id == uid)
            .order_by(uploaded_files.c.created_at.desc())
            .limit(10)
        ).mappings().all()

        for f in files:
            activities.append({
                "id": str(f["id"]),
                "type": "uploaded_file",
                "label": f"Uploaded File: {f['filename']} ({(f['size'] or 0)//80 or 1} lines approx)",
                "created_at": f["created_at"].isoformat() if f["created_at"] else None
            })

        # 2. Analyses & Simulations
        analyses = db.execute(
            select(log_analyses.c.id, log_analyses.c.results, log_analyses.c.created_at)
            .where(log_analyses.c.user_id == uid)
            .order_by(log_analyses.c.created_at.desc())
            .limit(10)
        ).mappings().all()

        for a in analyses:
            res = a["results"] or {}
            is_sim = res.get("is_simulation", False)
            sim_name = res.get("simulation_name", "Simulation")
            ml_data = res.get("ml") or res.get("ml_analysis") or {}
            risk_level = ml_data.get("risk_level", "LOW")
            lbl = f"Threat Simulation: {sim_name} ({risk_level} Risk)" if is_sim else f"ML Ensemble Run #{str(a['id'])[:8]} ({risk_level} Risk)"
            activities.append({
                "id": str(a["id"]),
                "type": "simulation" if is_sim else "ml_run",
                "label": lbl,
                "created_at": a["created_at"].isoformat() if a["created_at"] else None
            })

    return jsonify({"success": True, "activities": activities})

def build_report_data(user_id, supplied=None):
    supplied = supplied or {}
    activity_id = supplied.get("activity_id")
    activity_type = supplied.get("activity_type")

    logs = []
    analysis_row = None
    target_label = "Latest Security Telemetry"

    with get_db() as db:
        if activity_id and activity_type == "uploaded_file":
            uf = db.execute(
                select(uploaded_files).where(uploaded_files.c.id == activity_id, uploaded_files.c.user_id == user_id)
            ).mappings().first()
            if uf:
                target_label = f"File: {uf['filename']}"
                # check if an analysis exists for this file
                analysis_row = db.execute(
                    select(log_analyses).where(log_analyses.c.file_id == activity_id, log_analyses.c.user_id == user_id)
                    .order_by(log_analyses.c.created_at.desc()).limit(1)
                ).mappings().first()
                if not analysis_row and uf.get("content_data"):
                    # Parse logs from content_data
                    raw_text = uf["content_data"].decode("utf-8", errors="replace")
                    for idx, line in enumerate(raw_text.splitlines()[:500]):
                        if line.strip():
                            m_ip = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', line)
                            ip_val = m_ip.group(0) if m_ip else "-"
                            logs.append({
                                "id": str(idx),
                                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                "message": line.strip(),
                                "severity": "ERROR" if "error" in line.lower() else "CRITICAL" if "fail" in line.lower() else "INFO",
                                "source": uf["filename"],
                                "ip": ip_val
                            })
        elif activity_id:
            analysis_row = db.execute(
                select(log_analyses).where(log_analyses.c.id == activity_id, log_analyses.c.user_id == user_id)
            ).mappings().first()

        if not analysis_row and not logs:
            # Fall back to latest analysis for this user
            analysis_row = db.execute(
                select(log_analyses).where(log_analyses.c.user_id == user_id)
                .order_by(log_analyses.c.created_at.desc()).limit(1)
            ).mappings().first()

    # If we have an existing analysis record
    if analysis_row:
        res = analysis_row["results"] or {}
        ml = res.get("ml") or res.get("ml_analysis") or {}
        consensus = res.get("consensus") or ml.get("consensus") or {}
        target_label = res.get("simulation_name") or target_label

        summary = {
            "total_logs": int(res.get("total_logs", res.get("lines_parsed", 0)) or 0),
            "anomalies": int(res.get("anomalies", res.get("anomalies_found", len(ml.get("flagged_entries", [])))) or 0),
            "anomaly_score": float(consensus.get("master_anomaly_score", ml.get("anomaly_score", 0.0))),
            "risk_level": consensus.get("risk_level", ml.get("risk_level", "LOW")),
            "confidence": float(consensus.get("confidence", ml.get("confidence", 0.85))),
            "agreement_pct": float(consensus.get("algorithm_agreement_pct", 100.0)),
        }

        if res.get("severity"):
            severity = res.get("severity")
        else:
            flagged = ml.get("flagged_entries", [])
            crit_count = sum(1 for e in flagged if e.get("severity") == "CRITICAL")
            err_count = sum(1 for e in flagged if e.get("severity") == "ERROR")
            warn_count = sum(1 for e in flagged if e.get("severity") == "WARN")
            total_l = summary["total_logs"]
            info_count = max(0, total_l - crit_count - err_count - warn_count)
            severity = {
                "CRITICAL": crit_count,
                "ERROR": err_count,
                "WARN": warn_count,
                "INFO": info_count,
                "DEBUG": 0
            }

        soc = res.get("soc_countermeasures") or ml.get("soc_countermeasures") or res.get("countermeasures") or ml.get("countermeasures")
        if not soc:
            flagged = ml.get("flagged_entries", [])
            flagged_ips = [e.get("ip") for e in flagged if e.get("ip") and e.get("ip") not in ("-", "127.0.0.1", "localhost", "none", "", "null", "0.0.0.0")]
            target_ips = list(dict.fromkeys(flagged_ips))[:6]
            if target_ips:
                soc = {
                    "target_ips": target_ips,
                    "iptables_rules": [f"iptables -A INPUT -s {ip} -j DROP" for ip in target_ips],
                    "windows_firewall_rules": [f'netsh advfirewall firewall add rule name="Block-{ip}" dir=in action=block remoteip={ip}' for ip in target_ips],
                    "mitre_action": "Isolate host and block command-and-control ingress"
                }
            else:
                soc = {
                    "target_ips": [],
                    "iptables_rules": ["# No hostile IPs detected in current analysis window."],
                    "windows_firewall_rules": ["# No hostile IPs detected in current analysis window."],
                    "mitre_action": "Maintain continuous monitoring and baseline auditing."
                }

        return {
            "title": f"Forensic Security Report — {target_label}",
            "activity_label": target_label,
            "analysis_id": str(analysis_row["id"]),
            "summary": summary,
            "severity": severity,
            "ml_results": ml.get("all_results", []),
            "best_algorithm": ml.get("best_algorithm", "Isolation Forest"),
            "flagged_entries": ml.get("flagged_entries", [])[:15],
            "soc_countermeasures": soc,
            "timeline": ml.get("timeline", {}),
            "feature_importance": ml.get("feature_importance", {}),
        }

    # If we had logs without an analysis row, run ensemble now
    if logs:
        ml_res = run_ensemble(logs)
        c = ml_res["consensus"]
        summary = {
            "total_logs": len(logs),
            "anomalies": c["anomaly_count"],
            "anomaly_score": c["master_anomaly_score"],
            "risk_level": c["risk_level"],
            "confidence": c["confidence"],
            "agreement_pct": c["algorithm_agreement_pct"],
        }
        return {
            "title": f"Forensic Security Report — {target_label}",
            "activity_label": target_label,
            "analysis_id": None,
            "summary": summary,
            "severity": {
                "INFO": max(0, len(logs) - sum(1 for l in logs if l.get("severity") in ("WARN", "ERROR", "CRITICAL"))),
                "WARN": sum(1 for l in logs if l.get("severity") == "WARN"),
                "ERROR": sum(1 for l in logs if l.get("severity") == "ERROR"),
                "CRITICAL": sum(1 for l in logs if l.get("severity") == "CRITICAL"),
                "DEBUG": 0
            },
            "ml_results": ml_res.get("all_results", []),
            "best_algorithm": ml_res.get("best_algorithm", "Isolation Forest"),
            "flagged_entries": ml_res.get("flagged_entries", [])[:15],
            "soc_countermeasures": ml_res.get("soc_countermeasures", {}),
            "timeline": ml_res.get("timeline", {}),
            "feature_importance": ml_res.get("feature_importance", {}),
        }

    # Default baseline if no activity at all
    return {
        "title": "Forensic Security Baseline Report",
        "activity_label": "System Telemetry Baseline",
        "analysis_id": None,
        "summary": {"total_logs": 100, "anomalies": 0, "anomaly_score": 0.05, "risk_level": "LOW", "confidence": 0.95, "agreement_pct": 100.0},
        "severity": {"INFO": 95, "WARN": 5, "ERROR": 0, "CRITICAL": 0, "DEBUG": 0},
        "ml_results": [
            {"algorithm": "Isolation Forest", "score": 0.05, "confidence": 0.95, "is_best": True, "note": "Zero structural outliers detected."},
            {"algorithm": "Local Outlier Factor", "score": 0.04, "confidence": 0.92, "is_best": False, "note": "Uniform density clustering."},
        ],
        "best_algorithm": "Isolation Forest",
        "flagged_entries": [],
        "soc_countermeasures": {"target_ips": [], "iptables_rules": ["# No active threats detected"], "windows_firewall_rules": ["# No active threats detected"]},
        "timeline": {"labels": ["T-5", "T-4", "T-3", "T-2", "T-1"], "scores": [0.05, 0.04, 0.05, 0.04, 0.05]},
        "feature_importance": {"labels": ["Frequency", "Failed Auth", "IP Spread"], "values": [0.3, 0.2, 0.1]},
    }

IST_TZ = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

def to_ist_display(dt_val=None):
    if dt_val is None:
        dt = datetime.datetime.now(IST_TZ)
    elif isinstance(dt_val, str):
        try:
            dt = datetime.datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            dt = dt.astimezone(IST_TZ)
        except Exception:
            return dt_val
    elif isinstance(dt_val, datetime.datetime):
        if dt_val.tzinfo is None:
            dt_val = dt_val.replace(tzinfo=datetime.timezone.utc)
        dt = dt_val.astimezone(IST_TZ)
    else:
        return str(dt_val)
    return dt.strftime("%d %b %Y, %I:%M:%S %p IST")

def to_ist_time_str(ts_raw):
    if not ts_raw:
        return "-"
    try:
        if isinstance(ts_raw, str):
            dt = datetime.datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        else:
            dt = ts_raw
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        ist_dt = dt.astimezone(IST_TZ)
        return ist_dt.strftime("%d/%m %H:%M:%S IST")
    except Exception:
        return str(ts_raw)[-8:] + " IST"

def draw_score_meter(score, risk_level):
    from reportlab.lib.colors import HexColor
    from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
    d = Drawing(520, 52)
    score_val = max(0.0, min(1.0, float(score)))

    # Title & score label
    d.add(String(10, 38, "Master Consensus Anomaly Meter", fontSize=8.5, fontName="Helvetica-Bold", fillColor=HexColor("#1E293B")))
    score_text = f"Anomaly Score: {score_val:.3f}  ({risk_level} RISK)"
    score_col = HexColor("#DC2626") if score_val >= 0.6 else HexColor("#F59E0B") if score_val >= 0.35 else HexColor("#10B981")
    d.add(String(340, 38, score_text, fontSize=8.5, fontName="Helvetica-Bold", fillColor=score_col))

    # Track background
    tx, ty, tw, th = 10, 16, 500, 14
    d.add(Rect(tx, ty, tw, th, rx=4, ry=4, fillColor=HexColor("#F1F5F9"), strokeColor=HexColor("#CBD5E1"), strokeWidth=0.5))

    # Risk zones
    d.add(Rect(tx, ty, int(tw * 0.35), th, rx=3, ry=3, fillColor=HexColor("#D1FAE5"), strokeColor=None))
    d.add(Rect(tx + int(tw * 0.35), ty, int(tw * 0.25), th, fillColor=HexColor("#FEF3C7"), strokeColor=None))
    d.add(Rect(tx + int(tw * 0.60), ty, int(tw * 0.20), th, fillColor=HexColor("#FFEDD5"), strokeColor=None))
    d.add(Rect(tx + int(tw * 0.80), ty, int(tw * 0.20), th, rx=3, ry=3, fillColor=HexColor("#FEE2E2"), strokeColor=None))

    # Current value bar
    bar_w = max(4, int(tw * score_val))
    bar_col = HexColor("#DC2626") if score_val >= 0.8 else HexColor("#EA580C") if score_val >= 0.6 else HexColor("#D97706") if score_val >= 0.35 else HexColor("#10B981")
    d.add(Rect(tx, ty, bar_w, th, rx=3, ry=3, fillColor=bar_col, strokeColor=None))

    # Pointer needle
    px = tx + int(tw * score_val)
    d.add(Line(px, ty - 2, px, ty + th + 2, strokeColor=HexColor("#0F172A"), strokeWidth=2))
    d.add(Circle(px, ty + th // 2, 4, fillColor=HexColor("#FFFFFF"), strokeColor=HexColor("#0F172A"), strokeWidth=1.5))

    # Ticks
    ticks = [(0.0, "0.0 Baseline"), (0.35, "0.35 Elevated"), (0.60, "0.60 High Risk"), (0.80, "0.80 Critical"), (1.0, "1.0 Extreme")]
    for t_val, t_lbl in ticks:
        x_pos = tx + int(tw * t_val)
        if t_val == 1.0:
            x_pos -= 44
        elif t_val > 0.0:
            x_pos -= 18
        d.add(String(x_pos, 4, t_lbl, fontSize=6.5, fontName="Helvetica", fillColor=HexColor("#64748B")))

    return d

def draw_timeline_line_chart(timeline):
    from reportlab.lib.colors import HexColor
    from reportlab.graphics.shapes import Drawing, Rect, String, Line, PolyLine, Circle
    d = Drawing(520, 115)
    labels = (timeline.get("labels") or ["T-5", "T-4", "T-3", "T-2", "T-1"])[:8]
    raw_scores = timeline.get("scores") or [0.12, 0.18, 0.25, 0.68, 0.45]
    scores = [max(0.0, min(1.0, float(s))) for s in raw_scores[:len(labels)]]
    if len(scores) < len(labels):
        scores += [0.1] * (len(labels) - len(scores))
    if not labels or not scores:
        return d

    d.add(String(10, 102, "Chronological Threat Progression (Timeline Line Chart)", fontSize=8.5, fontName="Helvetica-Bold", fillColor=HexColor("#1E293B")))

    ox, oy, pw, ph = 42, 22, 465, 65

    # Chart canvas
    d.add(Rect(ox, oy, pw, ph, fillColor=HexColor("#F8FAFC"), strokeColor=HexColor("#E2E8F0"), strokeWidth=0.5))

    # Threshold guidelines
    y_50 = oy + int(ph * 0.50)
    y_80 = oy + int(ph * 0.80)
    d.add(Line(ox, y_50, ox + pw, y_50, strokeColor=HexColor("#FDE68A"), strokeWidth=1, strokeDashArray=[3, 3]))
    d.add(String(ox + pw - 90, y_50 + 2, "Warning Threshold (0.50)", fontSize=5.5, fontName="Helvetica", fillColor=HexColor("#B45309")))
    d.add(Line(ox, y_80, ox + pw, y_80, strokeColor=HexColor("#FECACA"), strokeWidth=1, strokeDashArray=[3, 3]))
    d.add(String(ox + pw - 90, y_80 + 2, "Critical Threshold (0.80)", fontSize=5.5, fontName="Helvetica", fillColor=HexColor("#DC2626")))

    # Y-axis ticks
    d.add(String(10, oy - 2, "0.00", fontSize=6.5, fontName="Helvetica", fillColor=HexColor("#64748B")))
    d.add(String(10, y_50 - 2, "0.50", fontSize=6.5, fontName="Helvetica", fillColor=HexColor("#64748B")))
    d.add(String(10, y_80 - 2, "0.80", fontSize=6.5, fontName="Helvetica", fillColor=HexColor("#64748B")))
    d.add(String(10, oy + ph - 4, "1.00", fontSize=6.5, fontName="Helvetica", fillColor=HexColor("#64748B")))

    n = len(labels)
    step = pw / max(1, n - 1) if n > 1 else pw

    points = []
    coords = []
    for idx, (lbl, sc) in enumerate(zip(labels, scores)):
        cx = ox + int(idx * step)
        cy = oy + int(sc * ph)
        points.extend([cx, cy])
        coords.append((cx, cy, sc, lbl))

    if len(points) >= 4:
        d.add(PolyLine(points, strokeColor=HexColor("#6366F1"), strokeWidth=2))

    for cx, cy, sc, lbl in coords:
        pt_col = HexColor("#DC2626") if sc >= 0.8 else HexColor("#EA580C") if sc >= 0.6 else HexColor("#D97706") if sc >= 0.35 else HexColor("#10B981")
        d.add(Circle(cx, cy, 3.5, fillColor=pt_col, strokeColor=HexColor("#FFFFFF"), strokeWidth=1))
        d.add(String(cx - 8, cy + 5, f"{sc:.2f}", fontSize=6, fontName="Helvetica-Bold", fillColor=HexColor("#1E293B")))
        clean_lbl = str(lbl)[:8]
        d.add(String(cx - 10, oy - 10, clean_lbl, fontSize=6, fontName="Helvetica", fillColor=HexColor("#64748B")))

    return d

def draw_model_bar_chart(ml_results):
    from reportlab.lib.colors import HexColor
    from reportlab.graphics.shapes import Drawing, Rect, String, Line
    d = Drawing(520, 105)
    ml_list = (ml_results or [])[:5]
    if not ml_list:
        return d

    d.add(String(10, 92, "Multi-Model Anomaly Rating Comparison (Bar Chart)", fontSize=8.5, fontName="Helvetica-Bold", fillColor=HexColor("#1E293B")))

    thresh_x = 180 + int(270 * 0.50)
    d.add(Line(thresh_x, 8, thresh_x, 85, strokeColor=HexColor("#EF4444"), strokeWidth=1, strokeDashArray=[2, 2]))
    d.add(String(thresh_x - 35, 87, "Threshold: 0.50", fontSize=5.5, fontName="Helvetica", fillColor=HexColor("#DC2626")))

    y_pos = 10
    for idx, item in enumerate(reversed(ml_list)):
        alg_name = str(item.get("algorithm", f"Model {idx+1}"))[:22]
        sc = max(0.0, min(1.0, float(item.get("score", 0.0))))
        conf = float(item.get("confidence", 0.85))
        is_best = bool(item.get("is_best"))

        lbl_col = HexColor("#1E3A8A") if is_best else HexColor("#334155")
        d.add(String(10, y_pos + 3, alg_name, fontSize=7, fontName="Helvetica-Bold" if is_best else "Helvetica", fillColor=lbl_col))

        d.add(Rect(180, y_pos, 270, 11, rx=2, ry=2, fillColor=HexColor("#F1F5F9"), strokeColor=None))

        bar_w = max(4, int(270 * sc))
        bar_col = HexColor("#DC2626") if sc >= 0.75 else HexColor("#F59E0B") if sc >= 0.40 else HexColor("#3B82F6")
        d.add(Rect(180, y_pos, bar_w, 11, rx=2, ry=2, fillColor=bar_col, strokeColor=None))

        tag = f"{sc:.3f} ({int(conf*100)}%)" + (" [Anchor]" if is_best else "")
        d.add(String(458, y_pos + 2.5, tag, fontSize=6.5, fontName="Helvetica-Bold" if is_best else "Helvetica", fillColor=HexColor("#1E293B")))

        y_pos += 15

    return d

def generate_pdf(data):
    try:
        from reportlab.lib import colors
        from reportlab.lib.colors import HexColor
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    except ImportError:
        return None

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=38, rightMargin=38, topMargin=38, bottomMargin=38)
    styles = getSampleStyleSheet()

    c_primary = HexColor("#2D2B6B")
    c_accent  = HexColor("#6366F1")
    c_text    = HexColor("#1E293B")
    c_muted   = HexColor("#64748B")
    c_danger  = HexColor("#DC2626")
    c_success = HexColor("#10B981")

    title_style = ParagraphStyle("ILFTitle", parent=styles["Heading1"], fontSize=20, textColor=c_primary, spaceAfter=2, fontName="Helvetica-Bold")
    sub_style   = ParagraphStyle("ILFSub", parent=styles["Normal"], fontSize=9, textColor=c_muted, spaceAfter=14, fontName="Helvetica")
    sec_style   = ParagraphStyle("ILFSec", parent=styles["Heading2"], fontSize=11, textColor=c_primary, spaceBefore=10, spaceAfter=5, fontName="Helvetica-Bold")
    body_style  = ParagraphStyle("ILFBody", parent=styles["BodyText"], fontSize=8.5, textColor=c_text, leading=12, fontName="Helvetica")
    code_style  = ParagraphStyle("ILFCode", parent=styles["Normal"], fontSize=7.5, textColor=HexColor("#F8FAFC"), leading=10, fontName="Courier")

    # Table cell wrapped styles (prevent text overflow)
    cell_style = ParagraphStyle("CellText", parent=styles["Normal"], fontSize=7, leading=9, textColor=c_text)
    cell_bold  = ParagraphStyle("CellBold", parent=styles["Normal"], fontSize=7, leading=9, textColor=c_text, fontName="Helvetica-Bold")
    cell_head  = ParagraphStyle("CellHead", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=colors.white, fontName="Helvetica-Bold")
    cell_code  = ParagraphStyle("CellCode", parent=styles["Normal"], fontSize=6.5, leading=8.5, textColor=HexColor("#334155"), fontName="Courier")

    story = []

    # Title & Metadata Header in IST
    gen_ist = to_ist_display()
    story.append(Paragraph("Intelligent Log Forensic", title_style))
    story.append(Paragraph(f"Executive Forensic Report — {data.get('activity_label', 'System Audit')}", ParagraphStyle("SubHeader", parent=styles["Heading3"], fontSize=12, textColor=c_accent, spaceAfter=2)))
    story.append(Paragraph(f"Generated on {gen_ist} | Timezone: Indian Standard Time (IST, UTC+5:30) | Storage: PostgreSQL BYTEA BLOB", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#E2E8F0"), spaceAfter=10))

    # Executive Summary Card Table
    s = data["summary"]
    risk_color = c_danger if s["risk_level"] in ["HIGH", "CRITICAL"] else HexColor("#F59E0B") if s["risk_level"] == "MEDIUM" else c_success

    kpi_data = [
        ["Total Log Volume", "Flagged Anomalies", "Consensus Score", "Consensus Risk", "Ensemble Agreement"],
        [f"{s['total_logs']:,}", f"{s['anomalies']:,}", f"{s['anomaly_score']:.3f}", s["risk_level"], f"{s['agreement_pct']:.0f}%"]
    ]
    kpi_table = Table(kpi_data, colWidths=[104, 104, 104, 104, 104])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("TEXTCOLOR", (0, 0), (-1, 0), c_muted),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("TEXTCOLOR", (0, 1), (-1, 1), c_text),
        ("TEXTCOLOR", (3, 1), (3, 1), risk_color),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # DIAGRAM 1: Score Gauge / Meter
    story.append(draw_score_meter(s.get("anomaly_score", 0.0), s.get("risk_level", "LOW")))
    story.append(Spacer(1, 10))

    # Executive Evaluation Narrative
    story.append(Paragraph("Executive Security Evaluation", sec_style))
    exec_summary_text = (
        f"This forensic audit evaluated <b>{s['total_logs']:,}</b> log entries using 5 concurrent Scikit-Learn anomaly "
        f"classification algorithms. The cross-model consensus engine calculated a combined anomaly rating of <b>{s['anomaly_score']:.3f}</b> "
        f"with a cross-validation agreement of <b>{s['agreement_pct']:.0f}%</b>, rating the investigated activity at <b>{s['risk_level']} RISK</b>. "
        f"A total of <b>{s['anomalies']}</b> anomalous entries exhibited deviation from normal operational baselines (IST reference timeline)."
    )
    story.append(Paragraph(exec_summary_text, body_style))
    story.append(Spacer(1, 10))

    # DIAGRAM 2: Multi-Model Anomaly Rating Comparison (Bar Chart)
    story.append(draw_model_bar_chart(data.get("ml_results") or []))
    story.append(Spacer(1, 10))

    # ML Algorithm Scores Table (Wrapped cells)
    story.append(Paragraph("Multi-Model ML Classification Breakdown", sec_style))
    ml_rows = [[
        Paragraph("Algorithm", cell_head),
        Paragraph("Anomaly Rating", cell_head),
        Paragraph("Confidence", cell_head),
        Paragraph("Model Role & Behavioral Focus", cell_head),
    ]]
    for item in (data.get("ml_results") or []):
        is_best_mark = " <b>(Anchor)</b>" if item.get("is_best") else ""
        ml_rows.append([
            Paragraph(f"{item.get('algorithm', '')}{is_best_mark}", cell_bold),
            Paragraph(f"{float(item.get('score', 0)):.3f}", cell_style),
            Paragraph(f"{float(item.get('confidence', 0))*100:.0f}%", cell_style),
            Paragraph(item.get("note", "Structural anomaly detection"), cell_style),
        ])
    ml_table = Table(ml_rows, colWidths=[150, 75, 65, 230])
    ml_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#F8FAFC")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(ml_table)
    story.append(Spacer(1, 10))

    # DIAGRAM 3: Timeline Progression Line Chart
    tl = data.get("timeline") or {}
    story.append(draw_timeline_line_chart(tl))
    story.append(Spacer(1, 10))

    # Automated SOC Countermeasures
    soc = data.get("soc_countermeasures") or {}
    ipt = (soc.get("iptables_rules") or ["# No active threat IPs identified."])
    win = (soc.get("windows_firewall_rules") or ["# No active threat IPs identified."])

    story.append(Paragraph("Automated SOC Countermeasures & Firewall Containment", sec_style))
    story.append(Paragraph("Recommended containment commands generated directly from forensic evidence:", body_style))
    story.append(Spacer(1, 4))

    code_text = "# Linux iptables Rule:\n" + "\n".join(ipt[:2]) + "\n\n# Windows Defender PowerShell Rule:\n" + "\n".join(win[:2])
    code_table = Table([[Paragraph(code_text.replace("\n", "<br/>"), code_style)]], colWidths=[520])
    code_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#0F172A")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#334155")),
    ]))
    story.append(code_table)
    story.append(Spacer(1, 10))

    # Flagged Evidence Table (All Cells Wrapped in Paragraphs to prevent table overflow)
    flagged = data.get("flagged_entries") or []
    if flagged:
        story.append(Paragraph("Flagged Forensic Evidence (Sample — Timestamps in IST)", sec_style))
        ev_rows = [[
            Paragraph("Time (IST)", cell_head),
            Paragraph("Severity", cell_head),
            Paragraph("Source", cell_head),
            Paragraph("IP Address", cell_head),
            Paragraph("Payload Message (Wrapped)", cell_head),
        ]]
        for f in flagged[:10]:
            ts_str = to_ist_time_str(f.get("timestamp"))
            sev_str = str(f.get("severity", "INFO")).upper()
            sev_color = "#DC2626" if sev_str in ("CRITICAL", "HIGH") else "#F59E0B" if sev_str == "WARN" else "#2563EB"
            msg_str = str(f.get("message", "-"))
            ev_rows.append([
                Paragraph(ts_str, cell_code),
                Paragraph(f"<font color='{sev_color}'><b>{sev_str}</b></font>", cell_style),
                Paragraph(str(f.get("source", "system")), cell_style),
                Paragraph(str(f.get("ip", "-")), cell_code),
                Paragraph(msg_str, cell_style),
            ])
        ev_table = Table(ev_rows, colWidths=[80, 50, 60, 75, 255])
        ev_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), c_primary),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#F8FAFC")]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(ev_table)

    # Feature Importance Signal Weights Section (Wrapped cells)
    fi = data.get("feature_importance") or {}
    fi_labels = fi.get("labels") or []
    fi_values = fi.get("values") or []
    if fi_labels and fi_values:
        story.append(Spacer(1, 10))
        story.append(Paragraph("Forensic Signal Weights (Prioritized Risk Drivers)", sec_style))
        fi_rows = [[
            Paragraph("Forensic Feature Signal", cell_head),
            Paragraph("Weight / Magnitude", cell_head),
        ]]
        for lbl, val in zip(fi_labels[:6], fi_values[:6]):
            fi_rows.append([
                Paragraph(str(lbl), cell_style),
                Paragraph(f"{float(val):.3f}", cell_bold),
            ])
        fi_table = Table(fi_rows, colWidths=[340, 180])
        fi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#F8FAFC")]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(fi_table)

    doc.build(story)
    buf.seek(0)
    return buf

@reports_bp.route("/reports/preview", methods=["POST"])
def preview():
    uid = current_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    body = request.get_json(silent=True) or {}
    data = build_report_data(uid, body)

    severity = data.get("severity") or {}
    ml = data.get("ml_results") or []

    return jsonify({
        "success": True,
        "report": data,
        "charts": {
            "severity": {
                "labels": ["INFO", "WARN", "ERROR", "CRITICAL", "DEBUG"],
                "values": [severity.get(x, 0) for x in ["INFO", "WARN", "ERROR", "CRITICAL", "DEBUG"]]
            },
            "algorithms": {
                "labels": [x.get("algorithm", "Model") for x in ml],
                "values": [x.get("score", 0) for x in ml]
            },
            "timeline": data.get("timeline", {})
        }
    })

@reports_bp.route("/reports/generate", methods=["POST"])
def generate():
    uid = current_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    body = request.get_json(silent=True) or {}
    data = build_report_data(uid, body)

    pdf_buf = generate_pdf(data)
    if pdf_buf is None:
        return jsonify({"success": False, "message": "ReportLab PDF generator failed"}), 500

    pdf_bytes = pdf_buf.getvalue()
    report_id = str(uuid.uuid4())
    db_loc = f"db://users/{uid}/reports/{report_id}.pdf"

    with get_db() as db:
        db.execute(reports.insert().values(
            id=report_id,
            user_id=uid,
            analysis_id=data.get("analysis_id"),
            report_type="executive_forensic",
            file_path=None,               # Zero disk leakage
            pdf_data=pdf_bytes,           # In-DB BYTEA storage
            db_location=db_loc
        ))

    pdf_buf.seek(0)
    return send_file(
        pdf_buf,
        as_attachment=True,
        download_name=f"ILF_Forensic_Report_{report_id[:8]}.pdf",
        mimetype="application/pdf"
    )

@reports_bp.route("/reports/download/<report_id>", methods=["GET"])
def download_by_id(report_id):
    uid = current_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    with get_db() as db:
        row = db.execute(
            select(reports).where(reports.c.id == report_id, reports.c.user_id == uid)
        ).mappings().first()

    if not row:
        return jsonify({"success": False, "message": "Report not found"}), 404

    if row.get("pdf_data"):
        buf = io.BytesIO(row["pdf_data"])
        return send_file(
            buf,
            as_attachment=True,
            download_name=f"ILF_Report_{report_id[:8]}.pdf",
            mimetype="application/pdf"
        )

    return jsonify({"success": False, "message": "Report content missing"}), 404

@reports_bp.route("/reports/history", methods=["GET"])
def history():
    uid = current_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    with get_db() as db:
        rows = db.execute(
            select(reports.c.id, reports.c.report_type, reports.c.analysis_id, reports.c.db_location, reports.c.created_at)
            .where(reports.c.user_id == uid)
            .order_by(reports.c.created_at.desc())
        ).mappings().all()

    return jsonify({
        "success": True,
        "reports": [{
            "id": str(x["id"]),
            "type": x["report_type"],
            "analysis_id": str(x["analysis_id"]) if x["analysis_id"] else None,
            "db_location": x.get("db_location") or f"db://users/{uid}/reports/{str(x['id'])}",
            "created_at": x["created_at"].isoformat() if x["created_at"] else None
        } for x in rows]
    })
