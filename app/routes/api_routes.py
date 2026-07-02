from flask import Blueprint, jsonify, request
from flask_login import login_required

from app.extensions import db
from app.models import NormalizedLog, UploadedFile
from app.services import dashboard_service
from app.utils.date_helper import iso_or_none
from app.utils.security_helper import require_owner


api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/dashboard/summary")
@login_required
def summary():
    return jsonify(dashboard_service.summary())


@api_bp.get("/dashboard/risk-distribution")
@login_required
def risk_distribution():
    return jsonify(dashboard_service.risk_distribution())


@api_bp.get("/dashboard/mitre-stats")
@login_required
def mitre_stats():
    return jsonify(dashboard_service.mitre_stats())


@api_bp.get("/dashboard/error-trends")
@login_required
def error_trends():
    return jsonify(dashboard_service.error_trends())


@api_bp.get("/dashboard/top-risky-ips")
@login_required
def top_risky_ips():
    return jsonify(dashboard_service.top_risky_ips())


@api_bp.get("/dashboard/timeline/<int:file_id>")
@login_required
def timeline(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    return jsonify(
        [
            {
                "id": incident.id,
                "title": incident.incident_title,
                "severity": incident.severity,
                "score": incident.overall_risk_score,
                "start": iso_or_none(incident.start_time),
                "end": iso_or_none(incident.end_time),
            }
            for incident in upload.incidents
        ]
    )


@api_bp.get("/upload/status/<int:file_id>")
@login_required
def upload_status(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    return jsonify(
        {
            "status": upload.processing_status,
            "total_records": upload.total_records,
            "error": upload.error_message,
        }
    )


@api_bp.get("/logs/filter")
@login_required
def filter_logs():
    file_id = request.args.get("file_id", type=int)
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    query = NormalizedLog.query.filter_by(file_id=upload.id)
    status = request.args.get("status", type=int)
    if status:
        query = query.filter_by(status_code=status)
    return jsonify(
        [
            {
                "id": log.id,
                "timestamp": iso_or_none(log.timestamp),
                "source_ip": log.source_ip,
                "endpoint": log.endpoint,
                "status_code": log.status_code,
                "response_time": log.response_time,
                "message": log.message,
            }
            for log in query.limit(500).all()
        ]
    )


@api_bp.get("/incidents/<int:file_id>")
@login_required
def incidents(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    return jsonify(
        [
            {
                "id": item.id,
                "title": item.incident_title,
                "severity": item.severity,
                "score": item.overall_risk_score,
                "summary": item.summary,
            }
            for item in upload.incidents
        ]
    )
