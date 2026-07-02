from flask import Blueprint, redirect, render_template, url_for
from flask_login import login_required

from app.models import UploadedFile
from app.services.dashboard_service import accessible_file_ids


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/")
def root():
    return redirect(url_for("dashboard.index"))


@dashboard_bp.get("/dashboard")
@login_required
def index():
    uploads = (
        UploadedFile.query.filter(UploadedFile.id.in_(accessible_file_ids()))
        .order_by(UploadedFile.upload_time.desc())
        .limit(6)
        .all()
    )
    return render_template("dashboard/dashboard.html", uploads=uploads)


@dashboard_bp.get("/admin/dashboard")
@login_required
def admin():
    return redirect(url_for("dashboard.index"))

