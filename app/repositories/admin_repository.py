from app.repositories.database import fetch_all, fetch_one


def overview():
    return {
        "users": fetch_one("SELECT COUNT(*) AS value FROM users")["value"],
        "uploads": fetch_one("SELECT COUNT(*) AS value FROM uploaded_files")["value"],
        "logs": fetch_one("SELECT COUNT(*) AS value FROM normalized_logs")["value"],
        "risks": fetch_one("SELECT COUNT(*) AS value FROM risk_events")["value"],
        "incidents": fetch_one("SELECT COUNT(*) AS value FROM incidents")["value"],
        "mitre_mappings": fetch_one("SELECT COUNT(*) AS value FROM mitre_mappings")["value"],
    }


def users():
    return fetch_all(
        """SELECT id, name, email, role, created_at, last_login, is_active_account
           FROM users ORDER BY created_at, id"""
    )


def uploads(limit=200):
    return fetch_all(
        """SELECT u.id, u.file_name, u.file_type, u.processing_status, u.total_records,
                  u.valid_records, u.invalid_records, u.upload_time, u.error_message,
                  owner.name AS owner_name
           FROM uploaded_files u JOIN users owner ON owner.id = u.user_id
           ORDER BY u.upload_time DESC LIMIT %s""",
        (min(max(int(limit or 200), 1), 500),),
    )


def database_status():
    info = fetch_one("SELECT current_database() AS name, version() AS version, current_user AS user")
    return {
        "database": info["name"],
        "user": info["user"],
        "version": (info["version"] or "").split(" on ")[0],
    }
