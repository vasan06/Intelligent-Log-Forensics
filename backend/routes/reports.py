"""User-scoped report preview, PDF generation and report history."""
import datetime, io, json, uuid
from pathlib import Path
import jwt
from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import select
from backend import config
from backend.database import get_db
from backend.models.log_analysis import log_analyses
from backend.models.report import reports
from backend.models.uploaded_file import uploaded_files

reports_bp = Blueprint("reports", __name__)

def current_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "): return None
    try:
        p = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        return str(p["sub"]) if p.get("type") == "access" else None
    except jwt.InvalidTokenError: return None

def _latest(user_id):
    with get_db() as db:
        row = db.execute(select(log_analyses.c.id, log_analyses.c.results, log_analyses.c.created_at)
            .where(log_analyses.c.user_id == str(user_id)).order_by(log_analyses.c.created_at.desc()).limit(1)).mappings().first()
    return row

def build_report_data(user_id, supplied=None):
    supplied = supplied or {}
    row = _latest(user_id)
    results = (row["results"] if row else {}) or {}
    if not isinstance(results, dict): results = {}
    ml = results.get("ml") or results.get("ml_analysis") or {}
    severity = results.get("severity") or {}
    summary = {
        "total_logs": int(results.get("total_logs", results.get("lines_parsed", 0)) or 0),
        "anomalies": int(results.get("anomalies", results.get("anomalies_found", len(ml.get("flagged_entries", [])))) or 0),
        "anomaly_score": ml.get("anomaly_score", 0),
        "risk_level": ml.get("risk_level", "LOW"),
    }
    data = {
        "type": supplied.get("type", "overall"),
        "source": supplied.get("source", "User Analysis"),
        "time_range": supplied.get("time_range", "Latest analysis"),
        "summary": {**summary, **(supplied.get("summary") or {})},
        "severity": severity,
        "ml_results": ml.get("all_results", []),
        "best_algorithm": ml.get("best_algorithm", "Unknown"),
        "flagged_entries": ml.get("flagged_entries", []),
        "timeline": ml.get("timeline", {}),
        "feature_importance": ml.get("feature_importance", {}),
        "mitre_results": supplied.get("mitre_results", []),
        "recommendations": supplied.get("recommendations", []),
        "analysis_id": str(row["id"]) if row else None,
    }
    return data

def preview_payload(data):
    severity = data.get("severity") or {}
    ml = data.get("ml_results") or []
    return {
        "success": True,
        "report": data,
        "charts": {
            "severity": {"labels": ["INFO","WARN","ERROR","CRITICAL","DEBUG"], "values": [severity.get(x,0) for x in ["INFO","WARN","ERROR","CRITICAL","DEBUG"]]},
            "algorithms": {"labels": [x.get("algorithm","Unknown") for x in ml], "values": [x.get("score",0) for x in ml]},
            "timeline": data.get("timeline", {}),
        },
    }

def generate_pdf(title, data):
    try:
        from reportlab.lib import colors
        from reportlab.lib.colors import HexColor
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.graphics.shapes import Drawing, Rect, String
    except ImportError:
        return None
    buf=io.BytesIO(); doc=SimpleDocTemplate(buf,pagesize=A4,leftMargin=42,rightMargin=42,topMargin=48,bottomMargin=48)
    styles=getSampleStyleSheet(); brand=HexColor("#2D2B6B"); muted=HexColor("#6B6880")
    title_style=ParagraphStyle("t",parent=styles["Heading1"],fontSize=22,textColor=brand,spaceAfter=4)
    h=ParagraphStyle("h",parent=styles["Heading2"],fontSize=13,textColor=brand,spaceBefore=14,spaceAfter=6)
    body=ParagraphStyle("b",parent=styles["BodyText"],fontSize=9,textColor=HexColor("#3A3845"),leading=13)
    story=[Paragraph("Intelligent Log Forensic",title_style),Paragraph(title,styles["Heading2"]),Paragraph(datetime.datetime.now(datetime.timezone.utc).strftime("Generated %Y-%m-%d %H:%M UTC"),body),Spacer(1,12)]
    s=data["summary"]; story += [Paragraph("Executive Summary",h),Paragraph(f'Total logs: <b>{s["total_logs"]:,}</b> &nbsp;&nbsp; Anomalies: <b>{s["anomalies"]:,}</b> &nbsp;&nbsp; Score: <b>{s["anomaly_score"]}</b> &nbsp;&nbsp; Risk: <b>{s["risk_level"]}</b>',body)]
    sev=data.get("severity") or {}; rows=[["Severity","Count"]]+[[k,str(sev.get(k,0))] for k in ["INFO","WARN","ERROR","CRITICAL","DEBUG"]]
    story += [Paragraph("Severity Distribution",h),Table(rows,colWidths=[180,100],style=TableStyle([("BACKGROUND",(0,0),(-1,0),brand),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.4,colors.lightgrey),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,HexColor("#F7F6F3")])]))]
    ml=data.get("ml_results") or []; rows=[["Algorithm","Score","Confidence"]]+[[str(x.get("algorithm","")),str(x.get("score",0)),str(x.get("confidence",0))] for x in ml]
    story += [Paragraph("ML Analysis",h),Table(rows,colWidths=[220,80,90],style=TableStyle([("BACKGROUND",(0,0),(-1,0),brand),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.4,colors.lightgrey)]))]
    if data.get("flagged_entries"):
        rows=[["Severity","Source","Message"]]+[[str(x.get("severity","")),str(x.get("source","")),str(x.get("message",""))[:100]] for x in data["flagged_entries"]]
        story += [Paragraph("Flagged Evidence",h),Table(rows,colWidths=[60,80,330],repeatRows=1,style=TableStyle([("BACKGROUND",(0,0),(-1,0),brand),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.3,colors.lightgrey)]))]
    mitre=data.get("mitre_results") or []
    if mitre:
        rows=[["Technique","Name","Tactic","Matches"]]+[[x.get("technique_id",x.get("technique","")),x.get("name",""),x.get("tactic",x.get("tactic_name","")),str(x.get("matches",0))] for x in mitre]
        story += [Paragraph("MITRE ATT&CK Mapping",h),Table(rows,colWidths=[70,180,130,60],repeatRows=1,style=TableStyle([("BACKGROUND",(0,0),(-1,0),brand),("TEXTCOLOR",(0,0),(-1,0),colors.white),("GRID",(0,0),(-1,-1),.3,colors.lightgrey)]))]
    story += [Paragraph("Algorithm Score Chart",h)]
    d=Drawing(460,180); maxv=max([float(x.get("score",0) or 0) for x in ml] or [1]); y=20
    for i,x in enumerate(ml[:8]):
        val=float(x.get("score",0) or 0); w=280*val/maxv if maxv else 0; d.add(Rect(145,y, w, 18, fillColor=brand, strokeColor=None)); d.add(String(5,y+4,str(x.get("algorithm",""))[:20],fontSize=8)); d.add(String(430,y+4,f"{val:.2f}",fontSize=8)); y+=22
    story.append(d)
    doc.build(story); buf.seek(0); return buf

@reports_bp.route("/reports/preview",methods=["POST"])
def preview():
    uid=current_user_id()
    if not uid: return jsonify({"success":False,"message":"Authentication required"}),401
    return jsonify(preview_payload(build_report_data(uid,request.get_json(silent=True) or {})))

@reports_bp.route("/reports/generate",methods=["POST"])
def generate():
    uid=current_user_id()
    if not uid: return jsonify({"success":False,"message":"Authentication required"}),401
    data=build_report_data(uid,request.get_json(silent=True) or {})
    pdf=generate_pdf("Log Forensics Report",data)
    if pdf is None: return jsonify({"success":False,"message":"ReportLab is not installed"}),500
    report_id=str(uuid.uuid4()); root=config.BASE_DIR/"instance"/"reports"; root.mkdir(parents=True,exist_ok=True); path=root/f"{report_id}.pdf"; path.write_bytes(pdf.getvalue())
    if data.get("analysis_id"):
        with get_db() as db:
            db.execute(reports.insert().values(id=report_id,user_id=uid,analysis_id=data["analysis_id"],report_type=data["type"],file_path=str(path)))
    pdf.seek(0); return send_file(pdf,as_attachment=True,download_name=f"ILF_Report_{report_id[:8]}.pdf",mimetype="application/pdf")

@reports_bp.route("/reports/history",methods=["GET"])
def history():
    uid=current_user_id()
    if not uid: return jsonify({"success":False,"message":"Authentication required"}),401
    with get_db() as db:
        rows=db.execute(select(reports.c.id,reports.c.report_type,reports.c.analysis_id,reports.c.created_at).where(reports.c.user_id==uid).order_by(reports.c.created_at.desc())).mappings().all()
    return jsonify({"success":True,"reports":[{"id":str(x["id"]),"type":x["report_type"],"analysis_id":str(x["analysis_id"]),"created_at":x["created_at"].isoformat() if x["created_at"] else None} for x in rows]})
