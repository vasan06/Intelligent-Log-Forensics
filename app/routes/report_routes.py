from flask import Blueprint, abort, render_template, send_file
from flask_login import current_user, login_required

from app.extensions import db
from app.models import Report, UploadedFile
from app.services.report_service import generate_report, resolve_report_path
from app.utils.security_helper import require_owner


reports_bp = Blueprint("reports", __name__, url_prefix="/reports")


@reports_bp.get("/<int:file_id>")
@login_required
def preview(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    return render_template("reports/report_preview.html", upload=upload)


@reports_bp.post("/generate/<int:file_id>")
@login_required
def generate(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    report = generate_report(upload, current_user.id)
    return send_file(
        resolve_report_path(report.report_path),
        as_attachment=True,
        download_name=report.report_name,
    )


@reports_bp.get("/download/<int:report_id>")
@login_required
def download(report_id):
    report = db.get_or_404(Report, report_id)
    require_owner(report.uploaded_file)
    path = resolve_report_path(report.report_path)
    if not path.exists():
        abort(404)
    return send_file(path, as_attachment=True, download_name=report.report_name)
