from flask import Blueprint, render_template
from flask_login import login_required

from flask import abort
from app.repositories import upload_repository
from app.utils.security_helper import require_owner


incidents_bp = Blueprint("incidents", __name__, url_prefix="/incidents")


@incidents_bp.get("/<int:file_id>")
@login_required
def view(file_id):
    upload = upload_repository.get(file_id)
    if not upload: abort(404)
    require_owner(upload)
    return render_template("incidents/incidents.html", file_id=file_id)
