import math
from typing import Any


def calculate_fidelity_rating(records: list[dict[str, Any]], threat_count: int) -> float:
    if not records:
        return 0.0

    total = len(records)
    
    valid_epochs = sum(1 for r in records if r.get("observed_epoch"))
    valid_ips = sum(1 for r in records if r.get("origin_address"))
    valid_statuses = sum(1 for r in records if r.get("response_code") is not None)

    epoch_fidelity = valid_epochs / total
    ip_fidelity = valid_ips / total
    status_fidelity = valid_statuses / total

    field_integrity = (epoch_fidelity * 0.40) + (ip_fidelity * 0.40) + (status_fidelity * 0.20)

    volume_factor = min(1.0, math.log10(max(1, total) + 9) / 3.0)

    threat_density = threat_count / total if total > 0 else 0
    threat_factor = 0.90 if threat_density < 0.85 else 0.70

    composite = (field_integrity * 55.0) + (volume_factor * 35.0) + (threat_factor * 10.0)
    
    return round(min(100.0, max(15.0, composite)), 1)
