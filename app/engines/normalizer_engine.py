import json
from datetime import datetime


ALIASES = {
    "timestamp": ("timestamp", "time", "datetime", "date", "@timestamp", "created_at"),
    "source_ip": ("source_ip", "ip", "ip_address", "client_ip", "remote_addr", "host"),
    "user_identifier": ("user_identifier", "user", "user_id", "username", "email"),
    "method": ("method", "http_method", "verb"),
    "endpoint": ("endpoint", "path", "url", "route", "request_uri"),
    "status_code": ("status_code", "status", "http_status", "response_code"),
    "response_time": ("response_time", "latency", "duration", "elapsed", "response_ms"),
    "event_type": ("event_type", "event", "type", "action"),
    "level": ("level", "severity", "log_level"),
    "message": ("message", "msg", "error", "description", "detail"),
}


def normalize_records(records):
    return [normalize_record(record) for record in records]


def normalize_record(record):
    lowered = {str(key).lower(): value for key, value in record.items()}
    normalized = {field: _first(lowered, aliases) for field, aliases in ALIASES.items()}
    normalized["timestamp"] = _parse_datetime(normalized["timestamp"])
    normalized["status_code"] = _to_int(normalized["status_code"])
    normalized["response_time"] = _response_ms(normalized["response_time"])
    normalized["method"] = str(normalized["method"] or "").upper() or None
    normalized["level"] = str(normalized["level"] or "").upper() or None
    normalized["raw_log"] = str(
        record.get("raw_log") or json.dumps(record, default=str, ensure_ascii=True)
    )
    normalized["log_source_type"] = classify_log_source(lowered, normalized)
    normalized["is_valid"] = bool(
        normalized["timestamp"]
        or normalized["message"]
        or normalized["endpoint"]
        or normalized["event_type"]
    )
    return normalized


def classify_log_source(source, normalized):
    """Classify heterogeneous records conservatively for dashboard pivots."""
    raw = normalized["raw_log"].lower()
    provider = " ".join(str(source.get(key, "")) for key in ("provider", "channel", "facility", "source", "program" )).lower()
    if any(token in raw + provider for token in ("eventid", "event_id", "microsoft-windows", "security-auditing")):
        return "Windows Security"
    if normalized.get("method") or normalized.get("endpoint") or any(token in raw for token in ("http/1.", "http/2", "user-agent", "request_uri")):
        return "Web / API"
    if any(token in raw + provider for token in ("firewall", "iptables", "ufw", "deny", "srcport", "dstport")):
        return "Firewall"
    if any(token in raw + provider for token in ("switch", "router", "interface", "vlan", "snmp", "link down")):
        return "Network Device"
    if any(token in raw for token in ("kernel:", "sshd[", "sudo:", "systemd[", "facility=")):
        return "Syslog"
    if any(token in raw + provider for token in ("database", "postgres", "mysql", "oracle", "sqlserver")):
        return "Database"
    return "Application"


def _first(record, aliases):
    for alias in aliases:
        value = record.get(alias)
        if value not in (None, ""):
            return value
    return None


def _parse_datetime(value):
    if not value:
        return None
    text = str(value).strip()
    candidates = (
        "%d/%b/%Y:%H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
    )
    cleaned = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(cleaned).replace(tzinfo=None)
    except ValueError:
        pass
    for pattern in candidates:
        try:
            return datetime.strptime(text, pattern).replace(tzinfo=None)
        except ValueError:
            continue
    return None


def _to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _response_ms(value):
    if value in (None, ""):
        return None
    text = str(value).lower().strip()
    try:
        number = float(text.replace("ms", "").replace("s", ""))
        return number * 1000 if text.endswith("s") and not text.endswith("ms") else number
    except ValueError:
        return None
