import json
import queue

from flask import Blueprint, Response, abort, jsonify, request, stream_with_context
from flask_login import login_required
from flask_login import current_user
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required, set_access_cookies, set_refresh_cookies

from app.extensions import limiter
from app.repositories import log_repository, risk_repository, upload_repository
from app.repositories import user_repository
from app.services import dashboard_service
from app.services.trust_score import for_file as trust_score_for_file
from app.utils.date_helper import iso_or_none
from app.utils.security_helper import require_owner


api_bp = Blueprint("api", __name__, url_prefix="/api/v1")


@api_bp.get("/auth/me")
@login_required
def me():
    return jsonify({"id": current_user.id, "name": current_user.name, "role": current_user.role})


@api_bp.get("/dashboard/summary")
@login_required
def summary(): return jsonify(dashboard_service.summary())

@api_bp.get("/dashboard/risk-distribution")
@login_required
def risk_distribution(): return jsonify(dashboard_service.risk_distribution())

@api_bp.get("/dashboard/log-sources")
@login_required
def log_sources(): return jsonify(dashboard_service.log_source_distribution())

@api_bp.get("/dashboard/mitre-stats")
@login_required
def mitre_stats(): return jsonify(dashboard_service.mitre_stats())

@api_bp.get("/dashboard/error-trends")
@login_required
def error_trends(): return jsonify(dashboard_service.error_trends())

@api_bp.get("/dashboard/top-risky-ips")
@login_required
def top_risky_ips(): return jsonify(dashboard_service.top_risky_ips())


def _owned_upload(file_id):
    upload = upload_repository.get(file_id)
    if not upload: abort(404)
    return require_owner(upload)


def _mapping_json(mapping):
    return None if not mapping else {"tactic": mapping.tactic, "technique_id": mapping.technique_id,
                                     "technique_name": mapping.technique_name, "confidence_score": mapping.confidence_score}


def _upload_json(upload, detailed=False):
    data = {"id": upload.id, "file_name": upload.file_name, "file_type": upload.file_type,
            "file_size": upload.file_size, "upload_time": iso_or_none(upload.upload_time),
            "processing_status": upload.processing_status, "total_records": upload.total_records,
            "valid_records": upload.valid_records, "invalid_records": upload.invalid_records,
            "content_hash": upload.content_hash,
            "quality": None if not upload.quality else {"quality_score": upload.quality.quality_score,
                "health_score": upload.quality.health_score, "duplicate_logs": upload.quality.duplicate_logs}}
    if detailed:
        data["risks"] = [{"id": risk.id, "log_id": risk.log_id, "risk_category": risk.risk_category,
                          "attack_type": risk.attack_type, "risk_score": risk.risk_score,
                          "severity": risk.severity, "reason": risk.reason,
                          "recommendation": risk.recommendation, "source": risk.source,
                          "mitre_mapping": _mapping_json(risk.mitre_mapping)} for risk in upload.risks]
        data["incident_count"] = len(upload.incidents)
        data["risk_count"] = len(upload.risks)
        data["forensic_trust"] = trust_score_for_file(upload.id)
    return data


@api_bp.get("/uploads")
@login_required
def uploads():
    limit = request.args.get("limit", type=int)
    limit = min(max(limit or 100, 1), 500)
    return jsonify([_upload_json(item) for item in upload_repository.list_accessible(current_user.id, current_user.role, limit)])


@api_bp.get("/uploads/<int:file_id>")
@login_required
def upload_analysis(file_id):
    return jsonify(_upload_json(_owned_upload(file_id), detailed=True))


@api_bp.get("/dashboard/timeline/<int:file_id>")
@login_required
def timeline(file_id):
    return jsonify([{"id": item.id, "title": item.incident_title, "severity": item.severity,
                     "score": item.overall_risk_score, "start": iso_or_none(item.start_time),
                     "end": iso_or_none(item.end_time)} for item in _owned_upload(file_id).incidents])


@api_bp.get("/upload/status/<int:file_id>")
@login_required
def upload_status(file_id):
    upload = _owned_upload(file_id)
    return jsonify({"status": upload.processing_status, "total_records": upload.total_records, "error": upload.error_message})


@api_bp.get("/logs/filter")
@login_required
def filter_logs():
    file_id = request.args.get("file_id", type=int)
    _owned_upload(file_id)
    logs = log_repository.for_file(file_id, request.args.get("status", type=int), request.args.get("q", "").strip(), request.args.get("source_type", "").strip())
    upload = _owned_upload(file_id)
    risks = {risk.log_id: risk for risk in upload.risks}
    return jsonify({"source_counts": log_repository.source_counts(file_id), "logs": [{"id": log.id, "timestamp": iso_or_none(log.timestamp), "source_ip": log.source_ip,
                     "method": log.method, "event_type": log.event_type,
                     "endpoint": log.endpoint, "status_code": log.status_code, "response_time": log.response_time,
                     "log_source_type": log.log_source_type, "message": log.message,
                     "risk": None if log.id not in risks else {"severity": risks[log.id].severity,
                         "risk_category": risks[log.id].risk_category}} for log in logs]})


@api_bp.get("/incidents/<int:file_id>")
@login_required
def incidents(file_id):
    upload = _owned_upload(file_id)
    return jsonify({"file_name": upload.file_name, "incidents": [{"id": item.id, "title": item.incident_title,
        "severity": item.severity, "score": item.overall_risk_score, "summary": item.summary,
        "events": [{"event_time": iso_or_none(event.event_time), "event_type": event.event_type,
                    "description": event.description, "mitre_tactic": event.mitre_tactic,
                    "mitre_technique": event.mitre_technique} for event in item.events]} for item in upload.incidents]})


@api_bp.post("/generator/start")
@login_required
@limiter.limit("20 per minute")
def generator_start():
    mode = (request.get_json(silent=True) or {}).get("mode", "normal")
    manager = current_app.extensions["live_generator"]
    try:
        manager.start(mode, current_user.id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"status": "running", "mode": mode}), 202


@api_bp.post("/generator/stop")
@login_required
@limiter.limit("20 per minute")
def generator_stop():
    manager = current_app.extensions["live_generator"]
    stopped = manager.stop()
    return jsonify({"status": "stopped" if stopped else "stopping", "error": manager.last_error})


@api_bp.post("/risk-events/<int:risk_id>/label")
@login_required
def label_risk_event(risk_id):
    label = (request.get_json(silent=True) or {}).get("label")
    if label not in {"confirmed", "false_positive"}:
        return jsonify({"error": "label must be confirmed or false_positive"}), 400
    risk = risk_repository.get_event(risk_id)
    if not risk:
        abort(404)
    _owned_upload(risk.file_id)
    updated = risk_repository.label(risk_id, label, current_user.id)
    return jsonify({"id": updated.id, "label": updated.analyst_label, "reviewed_at": iso_or_none(updated.reviewed_at)})


@api_bp.get("/model/labels-vs-f1")
@login_required
def labels_vs_f1():
    return jsonify([{"label_count": row["label_count"], "f1_score": row["f1_score"],
                     "model_version": row["model_version"], "created_at": iso_or_none(row["created_at"])}
                    for row in risk_repository.retraining_history()])


@api_bp.post("/auth/login")
@limiter.limit("10 per minute")
def jwt_login():
    payload = request.get_json(silent=True) or {}
    user = user_repository.find_by_email(payload.get("email", ""))
    if not user or not user.check_password(payload.get("password", "")):
        return jsonify({"error": "invalid credentials"}), 401
    response = jsonify({"user": {"id": user.id, "name": user.name, "role": user.role}})
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response


@api_bp.post("/auth/refresh")
@jwt_required(refresh=True)
def jwt_refresh():
    response = jsonify({"status": "refreshed"})
    set_access_cookies(response, create_access_token(identity=get_jwt_identity()))
    return response


@api_bp.get("/stream/live")
@login_required
def live_stream():
    broker = current_app.extensions["event_broker"]

    @stream_with_context
    def events():
        subscriber = broker.subscribe()
        try:
            yield "retry: 2000\n\n"
            while True:
                try:
                    event = subscriber.get(timeout=15)
                    yield f"event: risk\ndata: {json.dumps(event)}\n\n"
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            broker.unsubscribe(subscriber)

    return Response(events(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
