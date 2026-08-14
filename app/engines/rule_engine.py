from collections import Counter

from app.knowledge_base.taxonomy import entry


def detect_risks(records):
    auth_by_ip = Counter(row["source_ip"] for row in records if row["status_code"] in (401, 403))
    missing_by_ip = Counter(row["source_ip"] for row in records if row["status_code"] == 404)
    requests_by_ip = Counter(row["source_ip"] for row in records if row["source_ip"])
    risks = []
    for index, record in enumerate(records):
        status = record["status_code"] or 0
        message = str(record["message"] or "").lower()
        event = str(record["event_type"] or "").lower()
        level = str(record["level"] or "").lower()
        attack_text = " ".join((message, str(record.get("endpoint") or "").lower(), str(record.get("raw_log") or "").lower()))
        slug = reason = None
        score = 0
        if any(token in attack_text for token in ("sql injection", "union select", "or 1=1", "sleep(", "information_schema")):
            slug, score, reason = "sql-injection", 94, "SQL control syntax or an explicit injection indicator appears in the request evidence; database logs must confirm execution."
        elif any(token in attack_text for token in ("<script", "javascript:", "onerror=", "cross-site scripting", " xss")):
            slug, score, reason = "cross-site-scripting", 88, "Executable browser markup or an explicit XSS indicator appears in untrusted request data."
        elif any(token in attack_text for token in ("../", "..\\", "path traversal", "/etc/passwd", "win.ini")):
            slug, score, reason = "path-traversal", 92, "The request contains filesystem traversal sequences or a sensitive-file probe."
        elif any(token in attack_text for token in ("command injection", "; cat ", "| whoami", "cmd.exe /c", "/bin/sh")):
            slug, score, reason = "command-injection", 96, "Shell metacharacters or process invocation indicators suggest attempted command execution."
        elif status in (401, 403):
            attempts = auth_by_ip[record["source_ip"]]
            slug, score = "credential-attacks", min(95, 58 + attempts * 6)
            reason = f"This source produced {attempts} denied authentication request(s); repetition raises confidence."
        elif status == 404 and missing_by_ip[record["source_ip"]] >= 3:
            attempts = missing_by_ip[record["source_ip"]]
            slug, score = "route-scanning", min(82, 42 + attempts * 5)
            reason = f"Repeated unknown endpoint access ({attempts} requests) may indicate route probing."
        elif requests_by_ip[record["source_ip"]] >= 100 and status in (429, 503):
            slug, score = "denial-of-service", min(91, 65 + requests_by_ip[record["source_ip"]] / 20)
            reason = f"A single source generated {requests_by_ip[record['source_ip']]} requests alongside capacity or rate-limit responses."
        elif status >= 500:
            slug, score, reason = "operational-failure", 68 if status < 503 else 76, f"Server-side HTTP {status} failure affects application reliability."
        elif (record["response_time"] or 0) >= 1000:
            slug, score = "performance-degradation", min(85, 45 + record["response_time"] / 100)
            reason = f"Response time of {record['response_time']:.0f} ms exceeds the 1000 ms threshold."
        elif "frontend" in event or any(token in message for token in ("javascript", "uncaught", "hydration", "typeerror")):
            slug, score, reason = "frontend-runtime", 52, "A client-side runtime failure was reported."
        elif level in ("error", "critical", "fatal"):
            slug, score, reason = "security-warning", 45, f"Log severity is {level.upper()} and requires review."
        if slug:
            taxonomy = entry(slug)
            risks.append({"record_index": index, "risk_category": taxonomy["name"], "attack_type": slug,
                          "risk_score": round(score, 1), "severity": _severity(score), "reason": reason,
                          "evidence": record["raw_log"][:1000],
                          "recommendation": f"{taxonomy['fix']} Precaution: {taxonomy['precaution']}"})
    return risks


def _severity(score):
    if score >= 80: return "Critical"
    if score >= 60: return "High"
    if score >= 40: return "Medium"
    return "Low"
