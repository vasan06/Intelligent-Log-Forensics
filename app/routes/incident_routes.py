from flask import Blueprint, render_template, abort
from app.repositories import upload_repository

incidents_bp = Blueprint("incidents", __name__, url_prefix="/incidents")

@incidents_bp.get("")
def tracker():
    return render_template("incidents/incidents.html")

@incidents_bp.get("/<int:file_id>")
def view(file_id):
    upload = upload_repository.get(file_id)
    if not upload:
        abort(404)
    return render_template("incidents/incidents.html", file_id=file_id)
