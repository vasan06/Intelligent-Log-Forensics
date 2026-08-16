from flask import Blueprint

from flask import abort
from app.repositories import upload_repository
from app.utils.spa import render_spa


logs_bp = Blueprint("logs", __name__, url_prefix="/logs")


@logs_bp.get("/<int:file_id>")
def view(file_id):
    if not upload_repository.get(file_id):
        abort(404)
    return render_spa()
