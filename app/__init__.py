from pathlib import Path

from flask import Flask, flash, redirect, url_for
from sqlalchemy import inspect, text
from werkzeug.exceptions import RequestEntityTooLarge

from config import Config
from .extensions import db, login_manager


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["REPORT_FOLDER"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message_category = "warning"

    from .models import User
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

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    with app.app_context():
        db.create_all()
        # create_all() does not alter existing tables. Keep older databases
        # compatible with the current account model.
        columns = {column["name"] for column in inspect(db.engine).get_columns("users")}
        if "is_active_account" not in columns:
            with db.engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN is_active_account BOOLEAN NOT NULL DEFAULT TRUE"))
        log_columns = {column["name"] for column in inspect(db.engine).get_columns("normalized_logs")}
        if "log_source_type" not in log_columns:
            with db.engine.begin() as connection:
                connection.execute(text("ALTER TABLE normalized_logs ADD COLUMN log_source_type VARCHAR(40) NOT NULL DEFAULT 'Application'"))
        if not User.query.first():
            demo = User(name="Demo Analyst", email="analyst@example.com", role="analyst")
            demo.set_password("analyst123")
            db.session.add(demo)
            db.session.commit()

    @app.context_processor
    def inject_ui_config():
        return {"max_upload_mb": app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)}

    @app.errorhandler(RequestEntityTooLarge)
    def handle_oversized_upload(_error):
        limit = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        flash(f"That file exceeds the {limit} MB upload limit.", "danger")
        return redirect(url_for("upload.upload"))

    return app
