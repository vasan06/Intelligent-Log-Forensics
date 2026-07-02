from flask import Blueprint, render_template
from flask_login import login_required

from app.extensions import db
from app.models import UploadedFile
from app.utils.security_helper import require_owner


incidents_bp = Blueprint("incidents", __name__, url_prefix="/incidents")


@incidents_bp.get("/<int:file_id>")
@login_required
def view(file_id):
    upload = require_owner(db.get_or_404(UploadedFile, file_id))
    incidents = sorted(upload.incidents, key=lambda item: item.overall_risk_score, reverse=True)
    return render_template("incidents/incidents.html", upload=upload, incidents=incidents)
