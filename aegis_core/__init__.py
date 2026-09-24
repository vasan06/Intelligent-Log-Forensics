from pathlib import Path
from typing import Any

from flask import Flask

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


def initialize_sentinel_platform(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(SentinelSettings.ROOT_DIR / "templates"),
        # Keep the existing css/ and js/ folders as the single asset source.
        # Flask exposes them under /static without duplicating the frontend.
        static_folder=str(SentinelSettings.ROOT_DIR),
        static_url_path="/static",
    )

    app.config.update(
        SECRET_KEY=SentinelSettings.SECRET_KEY,
        MAX_CONTENT_LENGTH=SentinelSettings.MAX_BUNDLE_BYTES,
        DATABASE_LOCATION=SentinelSettings.DATABASE_LOCATION,
    )

    if test_config:
        app.config.update(test_config)

    SentinelSettings.INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    Path(SentinelSettings.VAULT_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
    Path(SentinelSettings.DOSSIER_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
    Path(app.config["DATABASE_LOCATION"]).parent.mkdir(parents=True, exist_ok=True)

    bootstrap_persistence(app.config["DATABASE_LOCATION"])

    @app.context_processor
    def inject_sentinel_context():
        return {
            "current_operator": resolve_active_operator(),
            "mitre_catalog": MITRE_ENTERPRISE_TAXONOMY,
            "platform_identity": SentinelSettings.APPLICATION_IDENTITY,
            "system_release": SentinelSettings.SYSTEM_RELEASE,
            "current_user": resolve_active_operator(),
        }

    app.register_blueprint(auth_blueprint)
    app.register_blueprint(ops_blueprint)
    app.register_blueprint(api_blueprint)

    # Clean URL aliases for template backward compatibility
    app.add_url_rule("/", endpoint="index", view_func=render_home_portal)
    app.add_url_rule("/login", endpoint="login", view_func=render_login_view, methods=["GET", "POST"])
    app.add_url_rule("/register", endpoint="register", view_func=render_registration_view, methods=["GET", "POST"])
    app.add_url_rule("/forgot-password", endpoint="forgot_password", view_func=render_recovery_view, methods=["GET", "POST"])
    app.add_url_rule("/logout", endpoint="logout", view_func=terminate_session)
    app.add_url_rule("/dashboard", endpoint="dashboard", view_func=render_command_deck)
    app.add_url_rule("/ingest", endpoint="ingest", view_func=render_ingest_station, methods=["GET", "POST"])
    app.add_url_rule("/incidents", endpoint="incidents", view_func=render_dockets_queue)
    app.add_url_rule("/incidents/<int:incident_id>", endpoint="incident_detail", view_func=render_docket_investigation)
    app.add_url_rule("/mitre", endpoint="mitre", view_func=render_mitre_matrix)
    app.add_url_rule("/remediation", endpoint="remediation", view_func=render_remediation_playbooks)
    app.add_url_rule("/archive", endpoint="archive", view_func=render_vault_archive)
    app.add_url_rule("/admin", endpoint="admin", view_func=render_commander_console)
    app.add_url_rule("/security-report", endpoint="security_report", view_func=download_forensic_dossier)

    return app
