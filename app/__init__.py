from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, abort, flash, jsonify, make_response, redirect, request, url_for
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from config import Config
from .extensions import jwt, limiter


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["REPORT_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["MODEL_FOLDER"]).mkdir(parents=True, exist_ok=True)

    jwt.init_app(app)
    limiter.init_app(app)

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
        if not request.path.startswith("/api/") or not origin:
            return
        allowed = {app.config["APP_ORIGIN"], app.config.get("FRONTEND_ORIGIN") or ""}
        allowed.discard("")
        if origin in allowed:
            return
        if origin == "null":
            abort(403)
        try:
            origin_host = urlparse(origin).hostname
        except ValueError:
            origin_host = None
        request_host = request.host.split(":")[0]
        if origin_host and origin_host == request_host:
            return
        abort(403)

    @app.after_request
    def security_and_cors_headers(response):
        origin = request.headers.get("Origin")
        allowed = {app.config["APP_ORIGIN"], app.config.get("FRONTEND_ORIGIN") or ""}
        allowed.discard("")
        if origin and origin in allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRF-TOKEN, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Vary"] = "Origin"

        # Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' unpkg.com https://unpkg.com; "
            "script-src 'self' 'unsafe-inline' unpkg.com https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss: http://localhost:5000 http://127.0.0.1:5000; "
            "frame-ancestors 'none';"
        )
        return response



    @jwt.user_lookup_loader
    def load_user(_jwt_header, jwt_data):
        from .repositories.user_repository import get
        return get(int(jwt_data["sub"]))

    def _jwt_error_response(message):
        """API calls get JSON 401; browser navigation gets redirected to login."""
        if request.path.startswith(("/api/", "/reports/")):
            return make_response(jsonify({"error": message}), 401)
        next_url = request.path if request.path != "/" else ""
        return redirect(url_for("auth.login", next=next_url))

    @jwt.unauthorized_loader
    def missing_token(_reason):
        return _jwt_error_response("Authentication required.")

    @jwt.invalid_token_loader
    def invalid_token(_reason):
        return _jwt_error_response("Invalid session.")

    @jwt.expired_token_loader
    def expired_token(_jwt_header, _jwt_data):
        return _jwt_error_response("Session expired.")

    @jwt.revoked_token_loader
    def revoked_token(_jwt_header, _jwt_data):
        return _jwt_error_response("Session revoked.")

    @jwt.user_lookup_error_loader
    def missing_user(_jwt_header, _jwt_data):
        return _jwt_error_response("Unknown account.")

    with app.app_context():
        from .repositories import user_repository
        if not user_repository.find_by_email("analyst@example.com"):
            user_repository.create("Demo Analyst", "analyst@example.com", "Analyst123!")

    from .repositories.database import close_connection
    app.teardown_appcontext(close_connection)

    @app.context_processor
    def inject_ui_config():
        return {"max_upload_mb": app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)}


    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": error.description}), error.code
        return error

    @app.errorhandler(RequestEntityTooLarge)
    def handle_oversized_upload(_error):
        limit = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        flash(f"That file exceeds the {limit} MB upload limit.", "danger")
        return redirect(url_for("upload.upload_page"))

    return app
