from flask import Blueprint
from app.utils.spa import render_spa

dashboard_bp = Blueprint("dashboard", __name__)

_SPA_ROUTES = [
    "/",
    "/dashboard",
    "/login",
    "/register",
    "/upload",
    "/upload/history",
    "/incidents",
    "/attack-intelligence",
    "/admin",
]

for _path in _SPA_ROUTES:
    dashboard_bp.add_url_rule(
        _path,
        endpoint=f"spa_{_path.strip('/') or 'root'}",
        view_func=render_spa,
    )

dashboard_bp.add_url_rule("/dashboard", endpoint="index", view_func=render_spa)


@dashboard_bp.get("/logs/<int:file_id>")
def logs_view(file_id):
    return render_spa()


@dashboard_bp.get("/incidents/<int:file_id>")
def incidents_view(file_id):
    return render_spa()


@dashboard_bp.get("/reports/<int:file_id>")
def reports_view(file_id):
    return render_spa()


@dashboard_bp.get("/attack-intelligence/<slug>")
def attack_detail(slug):
    return render_spa()


@dashboard_bp.get("/<path:path>")
def spa_fallback(path):
    return render_spa()