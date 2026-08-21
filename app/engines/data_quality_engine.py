def analyze_quality(records):
    total = len(records)
    fingerprints = [record["raw_log"] for record in records]
    duplicates = total - len(set(fingerprints))
    missing_timestamp = sum(record["timestamp"] is None for record in records)
    missing_ip = sum(not record["source_ip"] for record in records)
    invalid = sum(not record["is_valid"] for record in records)
    valid = total - invalid

    if not total:
        quality_score = 0
    else:
        penalty = (
            invalid * 35 + duplicates * 15 + missing_timestamp * 25 + missing_ip * 10
        ) / total
        quality_score = max(0, round(100 - penalty, 1))

    server_errors = sum((record["status_code"] or 0) >= 500 for record in records)
    slow = sum((record["response_time"] or 0) >= 1000 for record in records)
    health_penalty = ((server_errors * 45 + slow * 20) / total) if total else 100
    health_score = max(0, round(100 - health_penalty, 1)) if total else 0

    return {
        "total_logs": total,
        "valid_logs": valid,
        "invalid_logs": invalid,
        "duplicate_logs": duplicates,
        "missing_timestamp_count": missing_timestamp,
        "missing_ip_count": missing_ip,
        "quality_score": quality_score,
        "health_score": health_score,
    }

