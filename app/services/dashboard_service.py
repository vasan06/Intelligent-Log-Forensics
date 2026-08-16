from datetime import timedelta

from flask_jwt_extended import get_current_user

from app.repositories.database import fetch_all, fetch_one


def _scope(alias=""):
    prefix = f"{alias}." if alias else ""
    current = get_current_user()
    if current.role == "admin":
        return "", ()
    return f" WHERE {prefix}file_id IN (SELECT id FROM uploaded_files WHERE user_id=%s)", (current.id,)


def summary():
    where, params = _scope()
    logs = fetch_one(f"SELECT COUNT(*) AS count FROM normalized_logs{where}", params)["count"]
    risks = fetch_one(f"SELECT COUNT(*) AS count, COALESCE(AVG(risk_score),0) AS average FROM risk_events{where}", params)
    incidents = fetch_one(f"SELECT COUNT(*) AS count FROM incidents{where}", params)["count"]
    return {"total_logs": logs, "risk_events": risks["count"], "incidents": incidents, "average_risk": round(float(risks["average"]), 1)}


def overview():
    where, params = _scope()
    where_r, _ = _scope("r")
    where_i, _ = _scope("i")
    summary_data = summary()
    clause = f"{where} AND" if where else " WHERE"
    current = get_current_user()
    quality_clause = "" if current.role == "admin" else " WHERE uploaded_files.user_id=%s"
    quality_params = () if current.role == "admin" else (current.id,)
    quality = fetch_one(
        f"""SELECT COALESCE(AVG(quality_score),0) AS quality_score,
                   COALESCE(AVG(health_score),0) AS health_score
            FROM data_quality_results
            JOIN uploaded_files ON uploaded_files.id = data_quality_results.file_id{quality_clause}""",
        quality_params,
    )
    severity_rows = fetch_all(
        f"SELECT severity AS label, COUNT(*) AS count FROM risk_events{where} GROUP BY severity",
        params,
    )
    incident_rows = fetch_all(
        f"""SELECT i.id, i.incident_title, i.source_ip, i.affected_user, i.severity, i.overall_risk_score, i.summary
            FROM incidents i{where_i} ORDER BY i.overall_risk_score DESC, i.id DESC LIMIT 5""",
        params,
    )
    recent_rows = fetch_all(
        f"""SELECT r.id, r.risk_category, r.severity, r.risk_score, r.reason, r.created_at,
                   l.source_ip, l.endpoint, l.method, l.status_code, l.event_type
            FROM risk_events r
            JOIN normalized_logs l ON l.id = r.log_id{where_r}
            ORDER BY r.created_at DESC, r.id DESC LIMIT 10""",
        params,
    )
    anomaly_count = fetch_one(
        f"SELECT COUNT(*) AS count FROM risk_events{clause} severity IN ('High', 'Critical')",
        params,
    )["count"]
    return {
        **summary_data,
        "quality_score": round(float(quality["quality_score"]), 1),
        "health_score": round(float(quality["health_score"]), 1),
        "anomaly_count": anomaly_count,
        "severity_distribution": {row["label"]: row["count"] for row in severity_rows},
        "recent_incidents": [
            {
                "id": row["id"],
                "title": row["incident_title"],
                "source_ip": row["source_ip"],
                "affected_user": row["affected_user"],
                "severity": row["severity"],
                "score": row["overall_risk_score"],
                "summary": row["summary"],
            }
            for row in incident_rows
        ],
        "recent_events": [
            {
                "id": row["id"],
                "risk_category": row["risk_category"],
                "severity": row["severity"],
                "risk_score": row["risk_score"],
                "reason": row["reason"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "source_ip": row["source_ip"],
                "endpoint": row["endpoint"],
                "method": row["method"],
                "status_code": row["status_code"],
                "event_type": row["event_type"],
            }
            for row in recent_rows
        ],
    }


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
