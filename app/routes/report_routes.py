from flask import Blueprint, abort, send_file
from flask_jwt_extended import get_current_user, jwt_required

from app.repositories import report_repository, upload_repository
from app.services.report_service import generate_report, resolve_report_path
from app.utils.security_helper import require_owner
from app.utils.spa import render_spa


reports_bp = Blueprint("reports", __name__, url_prefix="/reports")


@reports_bp.get("/<int:file_id>")
def preview(file_id):
    upload = upload_repository.get(file_id)
    if not upload: abort(404)
    return render_spa()


@reports_bp.post("/generate/<int:file_id>")
@jwt_required()
def generate(file_id):
    upload = upload_repository.get(file_id)
    if not upload: abort(404)
    require_owner(upload)
    report = generate_report(upload, get_current_user().id)
    return send_file(
        resolve_report_path(report.report_path),
        as_attachment=True,
        download_name=report.report_name,
    )


@reports_bp.get("/download/<int:report_id>")
@jwt_required()
def download(report_id):
    report = report_repository.get(report_id)
    if not report: abort(404)
    upload = upload_repository.get(report.file_id, hydrate=False)
    if not upload: abort(404)
    require_owner(upload)
    path = resolve_report_path(report.report_path)
    if not path.exists():
        abort(404)
    return send_file(path, as_attachment=True, download_name=report.report_name)
