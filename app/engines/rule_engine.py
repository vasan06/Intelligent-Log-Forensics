from collections import Counter


RECOMMENDATIONS = {
    "Authentication Risk — Brute Force / Credential Stuffing": "Immediately rate-limit and temporarily block the source, revoke affected sessions, require MFA, reset exposed credentials, and review successful logins following the failures.",
    "Reconnaissance / Route Scanning": "Validate that requests are unauthorized scanning, block or challenge the source at the WAF, remove unnecessary route disclosure, and inspect subsequent exploit attempts.",
    "SQL Injection Attempt": "Quarantine the request, inspect database audit logs, parameterize the affected query, apply least-privilege database credentials, and deploy a tested WAF rule.",
    "Cross-Site Scripting Attempt": "Encode output by context, sanitize untrusted HTML, enforce a restrictive Content-Security-Policy, and invalidate sessions if script execution is confirmed.",
    "Path Traversal Attempt": "Block the source, canonicalize and allow-list paths, remove direct filesystem input, and inspect accessed files for secrets or configuration exposure.",
    "Command Injection Attempt": "Isolate the host if execution is suspected, remove shell invocation, use argument-safe APIs and allow-lists, rotate host secrets, and review process telemetry.",
    "Denial of Service Signal": "Enable edge rate limiting and autoscaling safeguards, identify expensive routes, block abusive sources, and preserve capacity for authenticated traffic.",
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
    requests_by_ip = Counter(record["source_ip"] for record in records if record["source_ip"])
    risks = []
    for index, record in enumerate(records):
        status = record["status_code"] or 0
        message = str(record["message"] or "").lower()
        event = str(record["event_type"] or "").lower()
        level = str(record["level"] or "").lower()
        category = reason = None
        score = 0

        attack_text = " ".join((message, str(record.get("endpoint") or "").lower(), str(record.get("raw_log") or "").lower()))
        if any(token in attack_text for token in ("sql injection", "union select", "or 1=1", "sleep(", "information_schema")):
            category, score = "SQL Injection Attempt", 94
            reason = "SQL control syntax or an explicit injection indicator appears in the request evidence; application and database logs must confirm execution."
        elif any(token in attack_text for token in ("<script", "javascript:", "onerror=", "cross-site scripting", " xss")):
            category, score = "Cross-Site Scripting Attempt", 88
            reason = "Executable browser markup or an explicit XSS indicator appears in untrusted request data."
        elif any(token in attack_text for token in ("../", "..\\", "path traversal", "/etc/passwd", "win.ini")):
            category, score = "Path Traversal Attempt", 92
            reason = "The request contains filesystem traversal sequences or a sensitive-file probe."
        elif any(token in attack_text for token in ("command injection", "; cat ", "| whoami", "cmd.exe /c", "/bin/sh")):
            category, score = "Command Injection Attempt", 96
            reason = "Shell metacharacters or process invocation indicators suggest attempted command execution."
        elif status in (401, 403):
            attempts = auth_by_ip[record["source_ip"]]
            category = "Authentication Risk — Brute Force / Credential Stuffing"
            score = min(95, 58 + attempts * 6)
            reason = f"This source produced {attempts} denied authentication request(s). Repetition raises confidence; distinguish password guessing from reused-credential attacks using account diversity."
        elif status == 404 and missing_by_ip[record["source_ip"]] >= 3:
            attempts = missing_by_ip[record["source_ip"]]
            category = "Reconnaissance / Route Scanning"
            score = min(82, 42 + attempts * 5)
            reason = f"Repeated unknown endpoint access ({attempts} requests) may indicate route probing."
        elif requests_by_ip[record["source_ip"]] >= 100 and status in (429, 503):
            category = "Denial of Service Signal"
            score = min(91, 65 + requests_by_ip[record["source_ip"]] / 20)
            reason = f"A single source generated {requests_by_ip[record['source_ip']]} requests alongside capacity or rate-limit responses."
        elif status >= 500:
            category = "Operational Risk"
            score = 68 if status < 503 else 76
            reason = f"Server-side HTTP {status} failure affects application reliability."
        elif (record["response_time"] or 0) >= 1000:
            category = "Performance Risk"
            score = min(85, 45 + (record["response_time"] / 100))
            reason = f"Response time of {record['response_time']:.0f} ms exceeds the 1000 ms threshold."
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
