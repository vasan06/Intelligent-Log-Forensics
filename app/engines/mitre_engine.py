MAPPINGS = {
    "Authentication Risk": {
        "tactic": "Credential Access",
        "technique_id": "T1110",
        "technique_name": "Brute Force",
        "confidence_score": 0.88,
    },
    "API Route Risk": {
        "tactic": "Discovery",
        "technique_id": "T1595",
        "technique_name": "Active Scanning",
        "confidence_score": 0.72,
    },
    "Security Risk": {
        "tactic": "Initial Access",
        "technique_id": "T1190",
        "technique_name": "Exploit Public-Facing Application",
        "confidence_score": 0.82,
    },
}


def map_risk(category):
    mapping = MAPPINGS.get(category)
    if not mapping:
        return None
    return {**mapping, "mapping_reason": f"{category} behavior matches the selected ATT&CK pattern."}

