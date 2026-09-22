from flask import Blueprint, render_template, abort
from app.repositories import upload_repository

logs_bp = Blueprint("logs", __name__, url_prefix="/logs")

@logs_bp.get("/<int:file_id>")
def view(file_id):
    if not upload_repository.get(file_id):
        abort(404)
    return render_template("logs/logs.html", file_id=file_id)
