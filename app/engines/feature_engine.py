from collections import Counter, defaultdict


FEATURE_NAMES = (
    "failed_login_count",
    "status_code",
    "route_frequency",
    "response_time",
    "error_frequency",
    "request_rate",
    "user_id",
    "ip_frequency",
)


def extract_feature_rows(records):
    """Return one numeric runtime-compatible feature vector per normalized log."""
    endpoint_counts = Counter(str(row.get("endpoint") or "") for row in records)
    ip_counts = Counter(str(row.get("source_ip") or "") for row in records)
    failures = Counter(
        str(row.get("source_ip") or "")
        for row in records
        if row.get("status_code") in (401, 403)
    )
    errors = Counter(
        str(row.get("source_ip") or "")
        for row in records
        if (row.get("status_code") or 0) >= 400
    )
    by_second = defaultdict(int)
    for row in records:
        timestamp = row.get("timestamp")
        key = timestamp.replace(microsecond=0) if hasattr(timestamp, "replace") else str(timestamp or "")
        by_second[key] += 1

    user_ids = {}
    vectors = []
    for row in records:
        user = str(row.get("user_identifier") or "")
        if user not in user_ids:
            user_ids[user] = len(user_ids)
        ip = str(row.get("source_ip") or "")
        endpoint = str(row.get("endpoint") or "")
        timestamp = row.get("timestamp")
        second = timestamp.replace(microsecond=0) if hasattr(timestamp, "replace") else str(timestamp or "")
        vectors.append(
            {
                "failed_login_count": failures[ip],
                "status_code": int(row.get("status_code") or 0),
                "route_frequency": endpoint_counts[endpoint],
                "response_time": float(row.get("response_time") or 0),
                "error_frequency": errors[ip],
                "request_rate": by_second[second],
                "user_id": user_ids[user],
                "ip_frequency": ip_counts[ip],
            }
        )
    return vectors


def matrix(feature_rows):
    return [[float(row[name]) for name in FEATURE_NAMES] for row in feature_rows]


def rule_baseline_predictions(feature_rows):
    """Apply transparent rule thresholds to the same rows consumed by ML evaluation."""
    return [int(
        row["failed_login_count"] >= 3
        or (row["status_code"] == 404 and row["error_frequency"] >= 3)
        or row["status_code"] >= 500
        or row["response_time"] >= 1000
        or row["request_rate"] >= 100
    ) for row in feature_rows]


def extract_features(records):
    statuses = Counter(record["status_code"] for record in records if record["status_code"])
    endpoints = Counter(record["endpoint"] for record in records if record["endpoint"])
    ips = Counter(record["source_ip"] for record in records if record["source_ip"])
    return {
        "failed_auth_count": statuses[401] + statuses[403],
        "not_found_count": statuses[404],
        "server_error_count": sum(count for code, count in statuses.items() if code >= 500),
        "slow_request_count": sum((record["response_time"] or 0) >= 1000 for record in records),
        "frontend_error_count": sum(
            "frontend" in str(record["event_type"] or "").lower()
            or "javascript" in str(record["message"] or "").lower()
            for record in records
        ),
        "top_endpoints": endpoints.most_common(10),
        "top_ips": ips.most_common(10),
        "rows": extract_feature_rows(records),
    }
