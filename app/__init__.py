from pathlib import Path

from flask import Flask, abort, flash, redirect, request, url_for
from werkzeug.exceptions import RequestEntityTooLarge

from config import Config
from .extensions import jwt, limiter, login_manager


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["REPORT_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["MODEL_FOLDER"]).mkdir(parents=True, exist_ok=True)

    login_manager.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message_category = "warning"

    from .routes.auth_routes import auth_bp
    from .routes.dashboard_routes import dashboard_bp
    from .routes.upload_routes import upload_bp
    from .routes.log_routes import logs_bp
    from .routes.incident_routes import incidents_bp
    from .routes.report_routes import reports_bp
    from .routes.api_routes import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(incidents_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(api_bp)

    from .services.live_trigger import LiveTrigger
    from .services.event_stream import EventBroker
    app.extensions["live_generator"] = LiveTrigger(app)
    app.extensions["event_broker"] = EventBroker()

    @app.before_request
    def enforce_same_origin_api():
        origin = request.headers.get("Origin")
        if request.path.startswith("/api/") and origin and origin != app.config["APP_ORIGIN"]:
            abort(403)

    @app.after_request
    def same_origin_headers(response):
        if request.headers.get("Origin") == app.config["APP_ORIGIN"]:
            response.headers["Access-Control-Allow-Origin"] = app.config["APP_ORIGIN"]
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
        return response

    @login_manager.user_loader
    def load_user(user_id):
        from .repositories.user_repository import get
        return get(int(user_id))

    with app.app_context():
        from .repositories import user_repository
        if not user_repository.find_by_email("analyst@example.com"):
            user_repository.create("Demo Analyst", "analyst@example.com", "analyst123")

    from .repositories.database import close_connection
    app.teardown_appcontext(close_connection)

    @app.context_processor
    def inject_ui_config():
        return {"max_upload_mb": app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)}

    @app.errorhandler(RequestEntityTooLarge)
    def handle_oversized_upload(_error):
        limit = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        flash(f"That file exceeds the {limit} MB upload limit.", "danger")
        return redirect(url_for("upload.upload"))

    return app
