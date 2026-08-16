from flask import Blueprint
from flask import abort
from app.repositories import upload_repository
from app.utils.spa import render_spa


incidents_bp = Blueprint("incidents", __name__, url_prefix="/incidents")


@incidents_bp.get("")
def tracker():
    return render_spa()


@incidents_bp.get("/<int:file_id>")
def view(file_id):
    upload = upload_repository.get(file_id)
    if not upload: abort(404)
    return render_spa()
