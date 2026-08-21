from collections import defaultdict


def build_incident_groups(risk_rows):
    groups = defaultdict(list)
    for risk, log, mapping in risk_rows:
        key = (log.source_ip or "unknown", risk.risk_category)
        groups[key].append((risk, log, mapping))
    return groups

