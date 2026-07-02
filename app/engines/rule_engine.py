from collections import Counter


RECOMMENDATIONS = {
    "Authentication Risk": "Rate-limit authentication, enforce MFA, and review the source account and IP.",
    "API Route Risk": "Review routing and access logs; block automated probing when confirmed.",
    "Security Risk": "Validate authorization controls, preserve evidence, and investigate the source identity.",
    "Performance Risk": "Profile the endpoint, inspect dependencies, and add latency monitoring.",
    "Operational Risk": "Inspect the stack trace and recent deployment or dependency changes.",
    "Frontend Runtime Risk": "Reproduce the client error, review source maps, and add frontend error telemetry.",
    "Warning": "Review the event in context and monitor for recurrence.",
}


def detect_risks(records):
    auth_by_ip = Counter(
        record["source_ip"] for record in records if record["status_code"] in (401, 403)
    )
    missing_by_ip = Counter(
        record["source_ip"] for record in records if record["status_code"] == 404
    )
    risks = []
    for index, record in enumerate(records):
        status = record["status_code"] or 0
        message = str(record["message"] or "").lower()
        event = str(record["event_type"] or "").lower()
        level = str(record["level"] or "").lower()
        category = reason = None
        score = 0

        if status in (401, 403):
            attempts = auth_by_ip[record["source_ip"]]
            category = "Authentication Risk"
            score = min(95, 58 + attempts * 6)
            reason = f"Unauthorized response detected; {attempts} failed request(s) from this source."
        elif status == 404 and missing_by_ip[record["source_ip"]] >= 3:
            attempts = missing_by_ip[record["source_ip"]]
            category = "API Route Risk"
            score = min(82, 42 + attempts * 5)
            reason = f"Repeated unknown endpoint access ({attempts} requests) may indicate route probing."
        elif status >= 500:
            category = "Operational Risk"
            score = 68 if status < 503 else 76
            reason = f"Server-side HTTP {status} failure affects application reliability."
        elif (record["response_time"] or 0) >= 1000:
            category = "Performance Risk"
            score = min(85, 45 + (record["response_time"] / 100))
            reason = f"Response time of {record['response_time']:.0f} ms exceeds the 1000 ms threshold."
        elif any(token in message for token in ("xss", "sql injection", "path traversal", "unauthorized access")):
            category = "Security Risk"
            score = 90
            reason = "The event message contains an explicit application security indicator."
        elif "frontend" in event or any(
            token in message for token in ("javascript", "uncaught", "hydration", "typeerror")
        ):
            category = "Frontend Runtime Risk"
            score = 52
            reason = "A client-side runtime failure was reported."
        elif level in ("error", "critical", "fatal"):
            category = "Warning"
            score = 45
            reason = f"Log severity is {level.upper()} and requires review."

        if category:
            risks.append(
                {
                    "record_index": index,
                    "risk_category": category,
                    "risk_score": round(score, 1),
                    "severity": _severity(score),
                    "reason": reason,
                    "evidence": record["raw_log"][:1000],
                    "recommendation": RECOMMENDATIONS[category],
                }
            )
    return risks


def _severity(score):
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"

