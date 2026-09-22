from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_jwt_extended import get_current_user, jwt_required

from app.services.upload_service import save_and_process
from app.utils.file_validator import validate_upload

upload_bp = Blueprint("upload", __name__, url_prefix="/upload")

@upload_bp.get("")
def upload_page():
    return render_template("upload/upload.html")

@upload_bp.post("")
@jwt_required()
def upload_form():
    file_storage = request.files.get("log_file")
    error = validate_upload(file_storage)
    if error:
        flash(error, "danger")
    else:
        try:
            uploaded = save_and_process(file_storage, get_current_user().id)
            flash("Log evidence analyzed successfully.", "success")
            return redirect(url_for("logs.view", file_id=uploaded.id))
        except Exception as exc:
            flash(f"Analysis failed: {exc}", "danger")
    return render_template("upload/upload.html")

@upload_bp.get("/history")
def history():
    return render_template("upload/history.html")
