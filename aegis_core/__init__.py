from pathlib import Path
from typing import Any
from flask import Flask, send_from_directory
from aegis_core.config import Settings
from aegis_core.persistence.engine import init_db
from aegis_core.security.identity import get_current_user
from aegis_core.web import auth_bp, app_bp, admin_bp, api_bp


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    root = Path(Settings.ROOT_DIR)

    app = Flask(
        __name__,
        template_folder=str(root / "templates"),
        static_folder=str(root / "static"),
        static_url_path="/static",
    )

    app.config.update(
        SECRET_KEY=Settings.SECRET_KEY,
        MAX_CONTENT_LENGTH=Settings.MAX_UPLOAD_BYTES,
        DATABASE_PATH=Settings.DATABASE_PATH,
        PERMANENT_SESSION_LIFETIME=Settings.SESSION_LIFETIME_SECONDS,
        TEMPLATES_AUTO_RELOAD=True,
        SEND_FILE_MAX_AGE_DEFAULT=0,
    )

    if test_config:
        app.config.update(test_config)

    # Ensure required dirs
    for d in [Settings.INSTANCE_DIR, Settings.UPLOADS_PATH, Settings.REPORTS_PATH]:
        Path(d).mkdir(parents=True, exist_ok=True)
    Path(Settings.DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)

    # Init DB
    init_db(app.config["DATABASE_PATH"])

    # Template context
    @app.context_processor
    def inject_globals():
        user = get_current_user()
        unread = 0
        if user:
            try:
                from aegis_core.persistence.engine import get_db
                with get_db() as conn:
                    unread = conn.execute(
                        "SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0",
                        (user.user_id,)
                    ).fetchone()["c"]
            except Exception:
                pass
        return {
            "current_user": user,
            "app_name": Settings.APP_NAME,
            "app_version": Settings.APP_VERSION,
            "unread_notifications": unread,
        }

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(app_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(api_bp)

    return app


# Backward compat
def initialize_sentinel_platform(test_config=None):
    return create_app(test_config)
