from datetime import timedelta

from flask_login import current_user

from app.repositories.database import fetch_all, fetch_one


def _scope(alias=""):
    prefix = f"{alias}." if alias else ""
    if current_user.role == "admin":
        return "", ()
    return f" WHERE {prefix}file_id IN (SELECT id FROM uploaded_files WHERE user_id=%s)", (current_user.id,)


def summary():
    where, params = _scope()
    logs = fetch_one(f"SELECT COUNT(*) AS count FROM normalized_logs{where}", params)["count"]
    risks = fetch_one(f"SELECT COUNT(*) AS count, COALESCE(AVG(risk_score),0) AS average FROM risk_events{where}", params)
    incidents = fetch_one(f"SELECT COUNT(*) AS count FROM incidents{where}", params)["count"]
    return {"total_logs": logs, "risk_events": risks["count"], "incidents": incidents, "average_risk": round(float(risks["average"]), 1)}


def _distribution(table, column):
    where, params = _scope()
    rows = fetch_all(f"SELECT {column} AS label, COUNT(*) AS count FROM {table}{where} GROUP BY {column}", params)
    return {row["label"] or "Unknown": row["count"] for row in rows}


def risk_distribution(): return _distribution("risk_events", "risk_category")
def log_source_distribution(): return _distribution("normalized_logs", "log_source_type")


def mitre_stats():
    where, params = _scope("r")
    rows = fetch_all(f"SELECT m.tactic AS label,COUNT(*) AS count FROM mitre_mappings m JOIN risk_events r ON r.id=m.risk_event_id{where} GROUP BY m.tactic", params)
    return {row["label"]: row["count"] for row in rows}


def top_risky_ips():
    where, params = _scope("r")
    rows = fetch_all(f"""SELECT l.source_ip AS ip,COUNT(r.id) AS events,AVG(r.risk_score) AS score
        FROM normalized_logs l JOIN risk_events r ON r.log_id=l.id{where}
        {'AND' if where else 'WHERE'} l.source_ip IS NOT NULL GROUP BY l.source_ip ORDER BY score DESC LIMIT 8""", params)
    return [{"ip": row["ip"], "events": row["events"], "score": round(float(row["score"]), 1)} for row in rows]


def error_trends():
    where, params = _scope()
    latest = fetch_one(f"SELECT MAX(timestamp) AS latest FROM normalized_logs{where}", params)["latest"]
    if not latest:
        return {"labels": [], "values": []}
    start = latest - timedelta(days=6)
    connector = " AND " if where else " WHERE "
    rows = fetch_all(f"SELECT DATE(timestamp) AS day,COUNT(*) AS count FROM normalized_logs{where}{connector}timestamp >= %s AND status_code >= 400 GROUP BY DATE(timestamp)", (*params, start))
    counts = {row["day"].isoformat(): row["count"] for row in rows}
    labels = [(latest.date() - timedelta(days=offset)).isoformat() for offset in range(6, -1, -1)]
    return {"labels": labels, "values": [counts.get(label, 0) for label in labels]}
