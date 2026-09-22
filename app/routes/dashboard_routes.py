from flask import Blueprint, render_template, abort
from app.knowledge_base.attack_catalog import ATTACKS

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.get("/")
@dashboard_bp.get("/dashboard")
def index():
    return render_template("dashboard/dashboard.html")

@dashboard_bp.get("/remediation")
def remediation():
    return render_template("dashboard/remediation.html")

@dashboard_bp.get("/attack-intelligence")
def attack_intelligence():
    return render_template("dashboard/attack_intelligence.html", attacks=ATTACKS)

@dashboard_bp.get("/attack-intelligence/<slug>")
def attack_detail(slug):
    attack = next((a for a in ATTACKS.values() if a["name"].lower().replace(" ", "-").replace("/", "-") == slug), None)
    if not attack:
        attack = list(ATTACKS.values())[0]
    return render_template("dashboard/attack_detail.html", attack=attack)

@dashboard_bp.get("/admin")
def admin():
    return render_template("admin/admin.html")

@dashboard_bp.get("/login")
def login():
    return render_template("auth/login.html")

@dashboard_bp.get("/register")
def register():
    return render_template("auth/register.html")