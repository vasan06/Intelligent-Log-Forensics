from pathlib import Path
from typing import Any

from flask import Flask, send_from_directory

from aegis_core.analytics.mitre_matrix import MITRE_ENTERPRISE_TAXONOMY
from aegis_core.config import SentinelSettings
from aegis_core.persistence.engine import bootstrap_persistence
from aegis_core.security.identity import resolve_active_operator
from aegis_core.web.controllers import (
    api_blueprint,
    auth_blueprint,
    download_forensic_dossier,
    ops_blueprint,
    render_command_deck,
    render_commander_console,
    render_docket_investigation,
    render_dockets_queue,
    render_home_portal,
    render_ingest_station,
    render_login_view,
    render_mitre_matrix,
    render_recovery_view,
    render_registration_view,
    render_remediation_playbooks,
    render_vault_archive,
    terminate_session,
)


def initialize_sentinel_platform(
    test_config: dict[str, Any] | None = None,
) -> Flask:

    # =========================================================
    # PROJECT PATHS
    # =========================================================

    root_dir = Path(SentinelSettings.ROOT_DIR)

    templates_dir = root_dir / "templates"
    css_dir = root_dir / "css"
    js_dir = root_dir / "js"

    # =========================================================
    # FLASK APPLICATION
    # =========================================================

    app = Flask(
        __name__,
        template_folder=str(templates_dir),
        static_folder=None,
    )

    # =========================================================
    # APPLICATION CONFIGURATION
    # =========================================================

    if not SentinelSettings.SECRET_KEY or not SentinelSettings.TOKEN_SIGNING_KEY:
        raise RuntimeError("SECRET_KEY and JWT_SECRET_KEY must be configured through the environment.")

    app.config.update(
        SECRET_KEY=SentinelSettings.SECRET_KEY,
        MAX_CONTENT_LENGTH=SentinelSettings.MAX_BUNDLE_BYTES,
        DATABASE_LOCATION=SentinelSettings.DATABASE_LOCATION,
    )

    if test_config:
        app.config.update(test_config)

    # =========================================================
    # REQUIRED DIRECTORIES
    # =========================================================

    SentinelSettings.INSTANCE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    Path(SentinelSettings.VAULT_STORAGE_PATH).mkdir(
        parents=True,
        exist_ok=True,
    )

    Path(SentinelSettings.DOSSIER_STORAGE_PATH).mkdir(
        parents=True,
        exist_ok=True,
    )

    Path(app.config["DATABASE_LOCATION"]).parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # =========================================================
    # DATABASE
    # =========================================================

    bootstrap_persistence(
        app.config["DATABASE_LOCATION"]
    )

    # =========================================================
    # TEMPLATE CONTEXT
    # =========================================================

    @app.context_processor
    def inject_sentinel_context():

        active_operator = resolve_active_operator()

        return {
            "current_operator": active_operator,
            "current_user": active_operator,
            "mitre_catalog": MITRE_ENTERPRISE_TAXONOMY,
            "platform_identity": SentinelSettings.APPLICATION_IDENTITY,
            "system_release": SentinelSettings.SYSTEM_RELEASE,
        }

    # =========================================================
    # CSS
    #
    # /static/css/...
    #       ↓
    # PROJECT_ROOT/CSS/...
    # =========================================================

    @app.route(
        "/static/css/<path:filename>",
        endpoint="static_css",
    )
    def serve_css(filename: str):

        return send_from_directory(
            css_dir,
            filename,
        )

    # =========================================================
    # JAVASCRIPT
    #
    # /static/js/...
    #       ↓
    # PROJECT_ROOT/js/...
    # =========================================================

    @app.route(
        "/static/js/<path:filename>",
        endpoint="static_js",
    )
    def serve_js(filename: str):

        return send_from_directory(
            js_dir,
            filename,
        )

    # =========================================================
    # GENERIC STATIC COMPATIBILITY
    #
    # Existing templates can continue using:
    #
    # url_for("static", filename="css/...")
    # url_for("static", filename="js/...")
    # =========================================================

    @app.route(
        "/static/<path:filename>",
        endpoint="static",
    )
    def serve_static(filename: str):

        normalized = filename.replace("\\", "/")

        if normalized.startswith("css/"):
            return send_from_directory(
                css_dir,
                normalized[4:],
            )

        if normalized.startswith("js/"):
            return send_from_directory(
                js_dir,
                normalized[3:],
            )

        return (
            "Static resource not found",
            404,
        )

    # =========================================================
    # BLUEPRINTS
    # =========================================================

    app.register_blueprint(auth_blueprint)
    app.register_blueprint(ops_blueprint)
    app.register_blueprint(api_blueprint)

    # =========================================================
    # PAGE ROUTES
    # =========================================================

    app.add_url_rule(
        "/",
        endpoint="index",
        view_func=render_home_portal,
    )

    app.add_url_rule(
        "/login",
        endpoint="login",
        view_func=render_login_view,
        methods=["GET", "POST"],
    )

    app.add_url_rule(
        "/register",
        endpoint="register",
        view_func=render_registration_view,
        methods=["GET", "POST"],
    )

    app.add_url_rule(
        "/forgot-password",
        endpoint="forgot_password",
        view_func=render_recovery_view,
        methods=["GET", "POST"],
    )

    app.add_url_rule(
        "/logout",
        endpoint="logout",
        view_func=terminate_session,
    )

    app.add_url_rule(
        "/dashboard",
        endpoint="dashboard",
        view_func=render_command_deck,
    )

    app.add_url_rule(
        "/ingest",
        endpoint="ingest",
        view_func=render_ingest_station,
        methods=["GET", "POST"],
    )

    app.add_url_rule(
        "/incidents",
        endpoint="incidents",
        view_func=render_dockets_queue,
    )

    app.add_url_rule(
        "/incidents/<int:incident_id>",
        endpoint="incident_detail",
        view_func=render_docket_investigation,
    )

    app.add_url_rule(
        "/mitre",
        endpoint="mitre",
        view_func=render_mitre_matrix,
    )

    app.add_url_rule(
        "/remediation",
        endpoint="remediation",
        view_func=render_remediation_playbooks,
    )

    app.add_url_rule(
        "/archive",
        endpoint="archive",
        view_func=render_vault_archive,
    )

    app.add_url_rule(
        "/admin",
        endpoint="admin",
        view_func=render_commander_console,
    )

    app.add_url_rule(
        "/security-report",
        endpoint="security_report",
        view_func=download_forensic_dossier,
    )

    # Production-facing resource names. Legacy operation URLs remain available
    # only as compatibility aliases while clients migrate.
    app.add_url_rule("/sign-in","sign_in",render_login_view,methods=["GET","POST"])
    app.add_url_rule("/sign-up","sign_up",render_registration_view,methods=["GET","POST"])
    app.add_url_rule("/forgot-password","forgot_password_public",render_recovery_view,methods=["GET","POST"])
    app.add_url_rule("/sign-out","sign_out",terminate_session)
    app.add_url_rule("/evidence","evidence",render_ingest_station,methods=["GET","POST"])
    app.add_url_rule("/analysis","analysis",render_ingest_station,methods=["GET","POST"])
    app.add_url_rule("/incidents","incidents_public",render_dockets_queue)
    app.add_url_rule("/mitre","mitre_public",render_mitre_matrix)
    app.add_url_rule("/reports","reports",download_forensic_dossier)
    app.add_url_rule("/admin","admin_public",render_commander_console)


    # =========================================================
    # RETURN FLASK APP
    # =========================================================

    return app