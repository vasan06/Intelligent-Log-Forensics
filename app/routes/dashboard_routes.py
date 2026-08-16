from flask import Blueprint, abort, redirect, url_for

from app.knowledge_base.attack_catalog import ATTACKS
from app.utils.spa import render_spa


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/")
def root():
    return redirect(url_for("dashboard.index"))


@dashboard_bp.get("/dashboard")
def index():
    return render_spa()


@dashboard_bp.get("/attack-intelligence")
def attack_intelligence():
    return render_spa()


@dashboard_bp.get("/attack-intelligence/<slug>")
def attack_detail(slug):
    attack = ATTACKS.get(slug)
    if not attack:
        abort(404)
    return render_spa()


@dashboard_bp.get("/login")
def spa_login():
    return render_spa()


@dashboard_bp.get("/register")
def spa_register():
    return render_spa()


@dashboard_bp.get("/admin")
def admin():
    return render_spa()


@dashboard_bp.get("/admin/dashboard")
def legacy_admin_redirect():
    return redirect(url_for("dashboard.admin"))
