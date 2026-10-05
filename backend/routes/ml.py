"""
routes/ml.py — ML analysis routes with automated snapshot persistence and task-logs loader.
"""

import uuid
from collections import Counter
from flask import Blueprint, request, jsonify
from sqlalchemy import select, update
import jwt

from backend.services.ml_service import run_ensemble
from backend.services.log_simulator import generate_logs
from backend import config
from backend.database import get_db
from backend.models.user import users
from backend.models.log_analysis import log_analyses
from backend.models.uploaded_file import uploaded_files
from backend.routes.logs import parse_log_content


ml_bp = Blueprint("ml", __name__)


def auth_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        uid = payload.get("sub") if payload.get("type") == "access" else None
        with get_db() as db:
            user = uid and db.execute(select(users).where(users.c.id == str(uid), users.c.verified.is_(True))).mappings().first()
        return user
    except jwt.InvalidTokenError:
        return None


@ml_bp.route("/ml/algorithms", methods=["GET"])
def algorithms():
    """Return the Scikit-Learn ML algorithms supported by ILF."""
    return jsonify({
        "success": True,
        "algorithms": [
            {"name": "Isolation Forest", "id": "isolation_forest", "type": "Unsupervised Space Partitioning"},
            {"name": "Local Outlier Factor (LOF)", "id": "lof", "type": "Density-Based Outlier Detection"},
            {"name": "One-Class SVM", "id": "one_class_svm", "type": "RBF Boundary Estimation"},
            {"name": "Random Forest Threat Classifier", "id": "random_forest", "type": "Supervised Pattern Matching"},
            {"name": "Temporal Sequence Analyzer", "id": "temporal_seq", "type": "Sequential Time-Series Modeling"},
        ],
    }), 200


@ml_bp.route("/ml/analyze", methods=["POST"])
def analyze():
    user = auth_user()
    if not user:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    uid = str(user["id"])
    data = request.get_json(silent=True) or {}

    source = data.get("source") or "all"
    time_range = data.get("time_range") or "1h"
    file_id = data.get("file_id")

    logs = data.get("logs")

    # If file_id is provided and logs not supplied, load from database BLOB!
    if not logs and file_id:
        with get_db() as db:
            f_row = db.execute(
                select(uploaded_files).where(uploaded_files.c.id == str(file_id), uploaded_files.c.user_id == uid)
            ).mappings().first()
            if f_row and f_row["content_data"]:
                parsed, _, _ = parse_log_content(f_row["content_data"], f_row["filename"])
                logs = parsed

    if logs is None:
        logs = generate_logs(80, "random", source)

    if not isinstance(logs, list):
        return jsonify({"success": False, "message": "logs must be a list"}), 400

    # Run Deep Scikit-Learn multi-model ensemble
    result = run_ensemble(logs, source, time_range)

    # Persist analysis snapshot into PostgreSQL
    analysis_id = str(uuid.uuid4())
    severity = Counter(str(l.get("severity", "INFO")).upper() for l in logs)
    sources_map = Counter(str(l.get("source", "ml")).lower() for l in logs)

    results_payload = {
        "source": source,
        "total_logs": len(logs),
        "lines_parsed": len(logs),
        "anomalies": len(result.get("flagged_entries", [])),
        "anomalies_found": len(result.get("flagged_entries", [])),
        "severity": dict(severity),
        "top_sources": dict(sources_map),
        "ml": result,
        "ml_analysis": result,
        "preview": logs[:100],
        "logs": logs,
    }

    # Check if analysis record already exists for this file_id or analysis_id
    existing_row = None
    with get_db() as db:
        if file_id:
            existing_row = db.execute(
                select(log_analyses).where(
                    log_analyses.c.file_id == str(file_id),
                    log_analyses.c.user_id == uid
                ).order_by(log_analyses.c.created_at.desc()).limit(1)
            ).mappings().first()
        elif data.get("analysis_id"):
            existing_row = db.execute(
                select(log_analyses).where(
                    log_analyses.c.id == str(data["analysis_id"]),
                    log_analyses.c.user_id == uid
                )
            ).mappings().first()

        if existing_row:
            analysis_id = str(existing_row["id"])
            existing_results = dict(existing_row["results"] or {})
            existing_results["ml"] = result
            existing_results["ml_analysis"] = result
            existing_results["anomalies"] = len(result.get("flagged_entries", []))
            existing_results["anomalies_found"] = len(result.get("flagged_entries", []))
            if not existing_results.get("logs") and logs:
                existing_results["logs"] = logs[:2000]
            db.execute(
                update(log_analyses).where(log_analyses.c.id == analysis_id).values(
                    results=existing_results,
                    status="completed",
                )
            )
        else:
            analysis_id = str(uuid.uuid4())
            db.execute(
                log_analyses.insert().values(
                    id=analysis_id,
                    user_id=uid,
                    file_id=str(file_id) if file_id else None,
                    status="completed",
                    results=results_payload,
                )
            )

    result["analysis_id"] = analysis_id
    result["file_id"] = file_id
    return jsonify(result), 200


@ml_bp.route("/ml/load-event/<event_id>", methods=["GET"])
def load_event(event_id):
    """Load logs and state from a previous upload or analysis for seamless handshake."""
    user = auth_user()
    if not user:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    uid = str(user["id"])
    with get_db() as db:
        # Check if event_id is an analysis_id
        a_row = db.execute(
            select(log_analyses).where(log_analyses.c.id == str(event_id), log_analyses.c.user_id == uid)
        ).mappings().first()

        if a_row:
            res = a_row["results"] or {}
            return jsonify({
                "success": True,
                "analysis_id": str(a_row["id"]),
                "file_id": str(a_row["file_id"]) if a_row["file_id"] else None,
                "logs": res.get("logs") or res.get("preview") or [],
                "ml": res.get("ml") or {},
                "scenario_name": res.get("scenario_name") or res.get("filename") or "Analysis Event",
            }), 200

        # Check if event_id is a file_id
        f_row = db.execute(
            select(uploaded_files).where(uploaded_files.c.id == str(event_id), uploaded_files.c.user_id == uid)
        ).mappings().first()

        if f_row and f_row["content_data"]:
            parsed, _, _ = parse_log_content(f_row["content_data"], f_row["filename"])
            return jsonify({
                "success": True,
                "file_id": str(f_row["id"]),
                "filename": f_row["filename"],
                "logs": parsed,
            }), 200

    return jsonify({"success": False, "message": "Event or file not found"}), 404