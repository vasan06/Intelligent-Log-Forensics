MAPPINGS = {
    "Authentication Risk — Brute Force / Credential Stuffing": {
        "tactic": "Credential Access",
        "technique_id": "T1110",
        "technique_name": "Brute Force",
        "confidence_score": 0.88,
    },
    "Reconnaissance / Route Scanning": {
        "tactic": "Discovery",
        "technique_id": "T1595",
        "technique_name": "Active Scanning",
        "confidence_score": 0.72,
    },
    "SQL Injection Attempt": {
        "tactic": "Initial Access",
        "technique_id": "T1190",
        "technique_name": "Exploit Public-Facing Application",
        "confidence_score": 0.82,
    },
    "Cross-Site Scripting Attempt": {"tactic": "Initial Access", "technique_id": "T1190", "technique_name": "Exploit Public-Facing Application", "confidence_score": 0.78},
    "Path Traversal Attempt": {"tactic": "Discovery", "technique_id": "T1083", "technique_name": "File and Directory Discovery", "confidence_score": 0.76},
    "Command Injection Attempt": {"tactic": "Execution", "technique_id": "T1059", "technique_name": "Command and Scripting Interpreter", "confidence_score": 0.86},
    "Denial of Service Signal": {"tactic": "Impact", "technique_id": "T1498", "technique_name": "Network Denial of Service", "confidence_score": 0.68},
}


def map_risk(category):
    mapping = MAPPINGS.get(category)
    if not mapping:
        return None
    return {**mapping, "mapping_reason": f"{category} behavior matches the selected ATT&CK pattern."}
