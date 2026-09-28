"""
app.py — ILF Backend Entry Point
Flask application factory.

Run from project root:
    python -m backend.app
"""

from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS

from backend.config import Config

from backend.routes.auth import auth_bp
from backend.routes.dashboard import dash_bp
from backend.routes.logs import logs_bp
from backend.routes.ml import ml_bp
from backend.routes.mitre import mitre_bp
from backend.routes.reports import reports_bp
from backend.routes.admin import admin_bp
from backend.routes.user import user_bp


# Project/frontend paths
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


def create_app():
    app = Flask(
        __name__,
        static_folder=str(FRONTEND_DIR / "assets"),
        static_url_path="/assets",
    )

    app.config.from_object(Config)

    CORS(
        app,
        origins=Config.CORS_ORIGINS,
        supports_credentials=True,
    )

    # -------------------------------------------------
    # API blueprints
    # -------------------------------------------------

    for bp in [
        auth_bp,
        dash_bp,
        logs_bp,
        ml_bp,
        mitre_bp,
        reports_bp,
        admin_bp,
        user_bp,
    ]:
        app.register_blueprint(bp, url_prefix="/api")

    # -------------------------------------------------
    # API health
    # -------------------------------------------------

    @app.route("/api/health")
    def health():
        return {
            "status": "ok",
            "service": "ILF Backend v2.0",
        }

    # -------------------------------------------------
    # Frontend pages
    # -------------------------------------------------

    @app.route("/")
    def landing():
        return send_from_directory(FRONTEND_DIR, "landing.html")

    @app.route("/login")
    def login():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/signup")
    def signup():
        return send_from_directory(FRONTEND_DIR, "signup.html")

    @app.route("/forgot-password")
    def forgot_password():
        return send_from_directory(FRONTEND_DIR, "forgot-password.html")

    @app.route("/dashboard")
    def dashboard():
        return send_from_directory(FRONTEND_DIR, "dashboard.html")

    @app.route("/admin")
    def admin():
        return send_from_directory(FRONTEND_DIR, "admin.html")

    @app.route("/live-monitor")
    def live_monitor():
        return send_from_directory(FRONTEND_DIR, "live-monitor.html")

    @app.route("/log-explorer")
    def log_explorer():
        return send_from_directory(FRONTEND_DIR, "log-explorer.html")

    @app.route("/mitre-catalog")
    def mitre_catalog():
        return send_from_directory(FRONTEND_DIR, "mitre-catalog.html")

    @app.route("/mitre-tracker")
    def mitre_tracker():
        return send_from_directory(FRONTEND_DIR, "mitre-tracker.html")

    @app.route("/ml-analysis")
    def ml_analysis():
        return send_from_directory(FRONTEND_DIR, "ml-analysis.html")

    @app.route("/reports")
    def reports():
        return send_from_directory(FRONTEND_DIR, "reports.html")

    @app.route("/profile")
    def profile():
        return send_from_directory(FRONTEND_DIR, "profile.html")

    # -------------------------------------------------
    # Direct HTML compatibility
    # -------------------------------------------------

    @app.route("/<page>.html")
    def html_page(page):
        filename = f"{page}.html"
        filepath = FRONTEND_DIR / filename

        if filepath.is_file():
            return send_from_directory(FRONTEND_DIR, filename)

        return {"error": "Page not found"}, 404

    return app


if __name__ == "__main__":
    print("\n  Intelligent Log Forensic — Backend v2.0")
    print("  Running at http://localhost:5000")
    print("  Frontend: http://localhost:5000/")
    print("  API:      http://localhost:5000/api/health")
    print("  All API calls visible in DevTools → Network\n")

    create_app().run(
        debug=True,
        port=5000,
    )