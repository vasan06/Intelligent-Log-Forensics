from flask import Blueprint, render_template, request
from flask_login import login_required

from app.extensions import db
from app.models import NormalizedLog, UploadedFile
from app.utils.security_helper import require_owner


logs_bp = Blueprint("logs", __name__, url_prefix="/logs")


@logs_bp.get("/<int:file_id>")
@login_required
def view(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    query = NormalizedLog.query.filter_by(file_id=file_id)
    severity = request.args.get("status")
    search = request.args.get("q", "").strip()
    source_type = request.args.get("source_type", "").strip()
    if severity:
        query = query.filter(NormalizedLog.status_code == int(severity))
    if search:
        query = query.filter(
            NormalizedLog.raw_log.ilike(f"%{search}%")
            | NormalizedLog.endpoint.ilike(f"%{search}%")
        )
    if source_type:
        query = query.filter(NormalizedLog.log_source_type == source_type)
    source_counts = dict(
        db.session.query(NormalizedLog.log_source_type, db.func.count(NormalizedLog.id))
        .filter_by(file_id=file_id).group_by(NormalizedLog.log_source_type).all()
    )
    logs = query.order_by(NormalizedLog.timestamp.desc()).limit(500).all()
    risks_by_log = {risk.log_id: risk for risk in upload.risks}
    return render_template(
        "logs/logs.html", upload=upload, logs=logs, risks_by_log=risks_by_log, source_counts=source_counts
    )
