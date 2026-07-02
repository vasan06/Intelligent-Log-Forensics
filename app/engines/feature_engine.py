from collections import Counter


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
    }

