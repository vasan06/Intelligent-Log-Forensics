from flask import Blueprint, render_template, request
from flask_login import login_required

from flask import abort
from app.repositories import log_repository, upload_repository
from app.utils.security_helper import require_owner


logs_bp = Blueprint("logs", __name__, url_prefix="/logs")


@logs_bp.get("/<int:file_id>")
@login_required
def view(file_id):
    upload = upload_repository.get(file_id)
    if not upload: abort(404)
    require_owner(upload)
    return render_template("logs/logs.html", file_id=file_id)
