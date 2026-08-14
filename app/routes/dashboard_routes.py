from flask import Blueprint, abort, redirect, render_template, url_for
from flask_login import login_required

from app.knowledge_base.attack_catalog import ATTACKS


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/")
def root():
    return redirect(url_for("dashboard.index"))


@dashboard_bp.get("/dashboard")
@login_required
def index():
    return render_template("dashboard/dashboard.html")


@dashboard_bp.get("/attack-intelligence")
@login_required
def attack_intelligence():
    return render_template("dashboard/attack_intelligence.html", attacks=ATTACKS)


@dashboard_bp.get("/attack-intelligence/<slug>")
@login_required
def attack_detail(slug):
    attack = ATTACKS.get(slug)
    if not attack:
        abort(404)
    return render_template("dashboard/attack_detail.html", attack=attack, slug=slug)


@dashboard_bp.get("/admin/dashboard")
@login_required
def admin():
    return redirect(url_for("dashboard.index"))
