"""
app.py — ILF Backend Entry Point
Flask application factory.

Run from project root:
    python -m backend.app
"""

from pathlib import Path

from backend.database import check_database_connection, init_database
from flask import Flask, send_from_directory
from flask_cors import CORS

from backend import config

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

    # Use the existing config module.
    app.config.from_object(config)
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_BYTES

    CORS(
        app,
        origins=config.CORS_ORIGINS,
        supports_credentials=True,
    )

    @app.errorhandler(413)
    def upload_too_large(_error):
        return {"success": False, "message": "Upload exceeds the configured file-size limit."}, 413

    # Initialize schema on startup for development. Production deployments should use migrations.
    try:
        init_database()
    except Exception as exc:
        app.logger.warning("Database initialization skipped: %s", exc)

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
        db_ok = check_database_connection()

        return {
            "status": "ok" if db_ok else "degraded",
            "service": "ILF Backend v2.0",
            "database": "connected" if db_ok else "unavailable",
        }, 200 if db_ok else 503

    # -------------------------------------------------
    # Frontend pages
    # -------------------------------------------------

    @app.route("/")
    def landing():
        return send_from_directory(FRONTEND_DIR, "landing.html")

    @app.route("/login")
    @app.route("/signin")
    def login():
        return send_from_directory(FRONTEND_DIR, "signin.html")

    @app.route("/signup")
    def signup():
        return send_from_directory(FRONTEND_DIR, "signup.html")

    @app.route("/forgot-password")
    def forgot_password():
        return send_from_directory(FRONTEND_DIR, "forgot-password.html")

    @app.route("/dashboard")
    def dashboard():
        response = send_from_directory(FRONTEND_DIR, "dashboard.html")
        response.headers["Cache-Control"] = (
            "no-store, no-cache, must-revalidate, max-age=0"
        )
        return response

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

    @app.route("/history")
    def history():
        return send_from_directory(FRONTEND_DIR, "history.html")

    @app.route("/profile")
    def profile():
        return send_from_directory(FRONTEND_DIR, "profile.html")

    # -------------------------------------------------
    # Direct HTML compatibility
    # -------------------------------------------------

    @app.route("/<page>.html")
    def html_page(page):
        from flask import redirect
        aliases = {"signin": "login"}
        filename = f"{page}.html"
        filepath = FRONTEND_DIR / filename
        if filepath.is_file():
            return redirect("/" + aliases.get(page, page), code=301)
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
