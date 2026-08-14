from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

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
                flash("Log evidence analyzed successfully.", "success")
                return redirect(url_for("logs.view", file_id=uploaded.id))
            except Exception as exc:
                flash(f"Analysis failed: {exc}", "danger")
    return render_template("upload/upload.html")


@upload_bp.get("/history")
@login_required
def history():
    return render_template("upload/history.html")
