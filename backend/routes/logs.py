"""Log ingestion and analysis. Uploaded files are persisted and owned by the authenticated user."""
import os, uuid, time, datetime, re, json, jwt
from collections import Counter
from pathlib import Path
from flask import Blueprint, request, jsonify
from sqlalchemy import select, update
from backend import config
from backend.database import get_db
from backend.models.user import users
from backend.models.uploaded_file import uploaded_files
from backend.models.log_analysis import log_analyses
from backend.services.log_simulator import generate_logs, SOURCES, MODES
from backend.services.ml_service import run_ensemble

logs_bp = Blueprint("logs", __name__)
_pipelines = {}

def auth_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        p = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        if p.get("type") != "access":
            return None
        uid = str(p.get("sub"))
        with get_db() as db:
            if not db.execute(select(users.c.id).where(users.c.id == uid, users.c.verified.is_(True))).first():
                return None
        return uid
    except jwt.InvalidTokenError:
        return None

def parse_log_file(path):
    logs, severity, sources = [], Counter(), Counter()
    pattern = re.compile(r"(?i)\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\b")
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line_no, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            if not line.strip():
                continue
            match = pattern.search(line)
            sev = (match.group(1).upper() if match else "INFO")
            if sev == "WARNING": sev = "WARN"
            if sev == "FATAL": sev = "CRITICAL"
            source_match = re.search(r"(?i)\b(?:source|service|app)=([\w.-]+)", line)
            source = source_match.group(1) if source_match else "uploaded"
            entry = {"timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(), "severity": sev, "source": source, "message": line, "line": line_no}
            logs.append(entry); severity[sev] += 1; sources[source] += 1
    return logs, severity, sources

@logs_bp.route("/logs/stream")
def stream():
    uid = auth_user_id()
    if not uid: return jsonify({"success": False, "message": "Authentication required"}), 401
    count = min(max(int(request.args.get("count", 10)), 1), 50)
    mode, src, sev = request.args.get("mode", "random"), request.args.get("source", "all"), request.args.get("severity", "all")
    return jsonify({"logs": generate_logs(count, mode, src, sev), "mode": mode, "count": count})

@logs_bp.route("/logs/modes")
def modes():
    return jsonify({"modes": [{"id": x, "label": x.replace("_"," ").title()} for x in MODES]})

@logs_bp.route("/logs/sources")
def sources():
    return jsonify({"sources": SOURCES})

@logs_bp.route("/logs/upload", methods=["POST"])
def upload():
    uid = auth_user_id()
    if not uid: return jsonify({"success": False, "message": "Authentication required"}), 401
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"success": False, "message": "No file provided"}), 400
    root = Path(config.BASE_DIR if hasattr(config, "BASE_DIR") else Path(__file__).resolve().parents[2]) / "instance" / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename).name
    file_id, stored = str(uuid.uuid4()), root / f"{uuid.uuid4()}-{safe_name}"
    file.save(stored)
    size = stored.stat().st_size
    try:
        parsed, severity, sources = parse_log_file(stored)
        ml = run_ensemble(parsed[:5000]) if parsed else {"success": False, "message": "No log lines"}
        results = {
            "total_logs": len(parsed), "lines_parsed": len(parsed),
            "anomalies": len(ml.get("flagged_entries", [])),
            "anomalies_found": len(ml.get("flagged_entries", [])),
            "severity": dict(severity), "top_sources": dict(sources),
            "ml": ml, "ml_analysis": ml,
            "log_volume": {level: [0]*24 for level in ("INFO","WARN","ERROR","CRITICAL","DEBUG")},
            "activity": {"days": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], "hours": [f"{h:02d}h" for h in range(0,24,2)], "data": [[0]*12 for _ in range(7)]},
            "preview": parsed[:20],
        }
        now = datetime.datetime.now(datetime.timezone.utc)
        for entry in parsed:
            try:
                dt = datetime.datetime.fromisoformat(str(entry["timestamp"]).replace("Z","+00:00"))
                h = dt.hour; results["log_volume"][entry["severity"]][h] += 1
                results["activity"]["data"][dt.weekday()][min(h//2,11)] += 1
            except Exception: pass
        with get_db() as db:
            db.execute(uploaded_files.insert().values(id=file_id,user_id=uid,filename=safe_name,storage_path=str(stored),size=size,status="analyzed"))
            analysis_id = str(uuid.uuid4())
            db.execute(log_analyses.insert().values(id=analysis_id,user_id=uid,file_id=file_id,status="completed",results=results))
        _pipelines[file_id] = {"stage": 3, "started": time.time(), "analysis_id": analysis_id}
        return jsonify({"success": True, "file_id": file_id, "analysis_id": analysis_id, "filename": safe_name, "size": size, "lines_parsed": len(parsed), "anomalies_found": len(ml.get("flagged_entries", [])), "preview": parsed[:20]}), 201
    except Exception as exc:
        try: stored.unlink(missing_ok=True)
        except Exception: pass
        return jsonify({"success": False, "message": f"File processing failed: {exc}"}), 500

@logs_bp.route("/logs/pipeline/<pipe_id>")
def pipeline_status(pipe_id):
    uid = auth_user_id()
    if not uid: return jsonify({"success": False, "message": "Authentication required"}), 401
    with get_db() as db:
        row = db.execute(select(uploaded_files.c.id, log_analyses.c.id.label("analysis_id"), log_analyses.c.status).select_from(uploaded_files.outerjoin(log_analyses, log_analyses.c.file_id==uploaded_files.c.id)).where(uploaded_files.c.id==pipe_id, uploaded_files.c.user_id==uid)).first()
    if not row: return jsonify({"success": False, "message": "Pipeline not found"}), 404
    return jsonify({"stage": 3, "label": "risk_score", "done": True, "stages": ["collect","parse","categorise","risk_score"], "analysis_id": row.analysis_id})
