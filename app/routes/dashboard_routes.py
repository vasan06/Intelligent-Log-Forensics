from flask import Blueprint, redirect, url_for

from app.utils.spa import render_spa

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/")
def root():
    return render_spa()


@dashboard_bp.get("/dashboard")
def index():
    return render_spa()


# Auth pages
@dashboard_bp.get("/login")
def spa_login():
    return render_spa()


@dashboard_bp.get("/register")
def spa_register():
    return render_spa()


# Evidence / upload pages
@dashboard_bp.get("/upload")
def upload_page():
    return render_spa()


@dashboard_bp.get("/upload/history")
def upload_history():
    return render_spa()


# Log explorer
@dashboard_bp.get("/logs/<int:file_id>")
def logs_view(file_id):
    return render_spa()


# Incidents
@dashboard_bp.get("/incidents")
def incidents_list():
    return render_spa()


@dashboard_bp.get("/incidents/<int:file_id>")
def incidents_view(file_id):
    return render_spa()


# Reports
@dashboard_bp.get("/reports/<int:file_id>")
def reports_view(file_id):
    return render_spa()


# Attack intelligence
@dashboard_bp.get("/attack-intelligence")
def attack_intelligence():
    return render_spa()


@dashboard_bp.get("/attack-intelligence/<slug>")
def attack_detail(slug):
    return render_spa()


# Admin
@dashboard_bp.get("/admin")
def admin():
    return render_spa()


@dashboard_bp.get("/admin/dashboard")
def legacy_admin_redirect():
    return redirect(url_for("dashboard.admin"))
