from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.models import UploadedFile
from app.services.dashboard_service import accessible_file_ids
from app.services.upload_service import save_and_process
from app.utils.file_validator import validate_upload


upload_bp = Blueprint("upload", __name__, url_prefix="/upload")


@upload_bp.route("", methods=["GET", "POST"])
@login_required
def upload():
    if request.method == "POST":
        file_storage = request.files.get("log_file")
        error = validate_upload(file_storage)
        if error:
            flash(error, "danger")
        else:
            try:
                uploaded = save_and_process(file_storage, current_user.id)
                flash(f"{uploaded.file_name} analyzed successfully.", "success")
                return redirect(url_for("logs.view", file_id=uploaded.id))
            except Exception as exc:
                flash(f"Analysis failed: {exc}", "danger")
    return render_template("upload/upload.html")


@upload_bp.get("/history")
@login_required
def history():
    uploads = (
        UploadedFile.query.filter(UploadedFile.id.in_(accessible_file_ids()))
        .order_by(UploadedFile.upload_time.desc())
        .all()
    )
    return render_template("upload/history.html", uploads=uploads)

