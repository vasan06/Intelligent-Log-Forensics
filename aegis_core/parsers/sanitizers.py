from datetime import datetime, timezone
import ipaddress
import re
from dateutil import parser as date_parser


HTTP_STATUS_BOUNDARY_REGEX = re.compile(
    r'(?:HTTP/\d(?:\.\d)?["\'\s]+|\s+|^)([1-5]\d{2})(?:\s+|$|(?=[^\w.]))'
)

IPV4_REGEX = re.compile(r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b')
HTTP_VERB_REGEX = re.compile(r'\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b', re.IGNORECASE)


def validate_ip_address(raw_token: str | None) -> str | None:
    if not raw_token:
        return None
    raw_token = raw_token.strip().strip("[]").split(":")[0] if "." in raw_token else raw_token.strip().strip("[]")
    try:
        addr = ipaddress.ip_address(raw_token)
        return str(addr)
    except ValueError:
        match = IPV4_REGEX.search(raw_token)
        if match:
            return match.group(0)
    return None


def validate_http_status(candidate: any, contextual_text: str | None = None) -> int | None:
    if candidate is not None:
        try:
            val = int(candidate)
            if 100 <= val <= 599:
                return val
        except (ValueError, TypeError):
            pass

    if contextual_text:
        for match in HTTP_STATUS_BOUNDARY_REGEX.finditer(contextual_text):
            candidate_val = int(match.group(1))
            if 100 <= candidate_val <= 599:
                return candidate_val

    return None


def normalize_temporal_epoch(candidate: str | None) -> str | None:
    if not candidate:
        return None
    
    cleaned = candidate.strip("[]() ")
    if not cleaned:
        return None
        
    try:
        dt = date_parser.parse(cleaned, fuzzy=True)
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec="seconds")
    except (ValueError, OverflowError, TypeError):
        pass
        
    return None


def extract_http_verb(text: str | None) -> str | None:
    if not text:
        return None
    match = HTTP_VERB_REGEX.search(text)
    return match.group(1).upper() if match else None
