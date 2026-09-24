import base64
from dataclasses import dataclass
from functools import wraps
import hashlib
import hmac
import json
import time
from typing import Callable, Optional

from flask import flash, redirect, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from aegis_core.config import SentinelSettings
from aegis_core.persistence.engine import acquire_connection


@dataclass
class OperatorContext:
    operator_id: int
    display_name: str
    work_email: str
    clearance_tier: str

    @property
    def is_commander(self) -> bool:
        return self.clearance_tier.lower() == "commander"


def issue_access_ticket(operator_id: int, clearance_tier: str) -> str:
    now_ts = int(time.time())
    payload = {
        "sub": operator_id,
        "clr": clearance_tier,
        "iat": now_ts,
        "exp": now_ts + SentinelSettings.SESSION_LIFESPAN_SECONDS,
    }
    raw_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(raw_json).decode("utf-8").rstrip("=")
    
    secret = SentinelSettings.TOKEN_SIGNING_KEY.encode("utf-8")
    signature = hmac.new(secret, b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    
    return f"{b64_payload}.{signature}"


def verify_access_ticket(ticket: str | None) -> Optional[int]:
    if not ticket or "." not in ticket:
        return None
        
    parts = ticket.rsplit(".", 1)
    if len(parts) != 2:
        return None
    b64_payload, signature = parts
    
    secret = SentinelSettings.TOKEN_SIGNING_KEY.encode("utf-8")
    expected_sig = hmac.new(secret, b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    
    if not hmac.compare_digest(expected_sig, signature):
        return None
        
    try:
        padding = "=" * (-len(b64_payload) % 4)
        raw_bytes = base64.urlsafe_b64decode(b64_payload + padding)
        data = json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        return None
        
    if data.get("exp", 0) < int(time.time()):
        return None
        
    return data.get("sub")


def resolve_active_operator() -> Optional[OperatorContext]:
    op_id = session.get("active_operator_id") or verify_access_ticket(
        request.cookies.get("aegis_session_token")
    )
    if not op_id:
        return None
        
    with acquire_connection() as conn:
        row = conn.execute(
            "SELECT operator_id, display_name, work_email, clearance_tier FROM operators WHERE operator_id = ?",
            (op_id,)
        ).fetchone()
        if row:
            return OperatorContext(
                operator_id=row["operator_id"],
                display_name=row["display_name"],
                work_email=row["work_email"],
                clearance_tier=row["clearance_tier"],
            )
    return None


def require_clearance(minimum_tier: str = "Analyst") -> Callable:
    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            op = resolve_active_operator()
            if not op:
                flash("Operator credential validation required.", "warning")
                return redirect(url_for("auth_views.render_login_view"))
                
            if minimum_tier.lower() == "commander" and not op.is_commander:
                flash("High-level Commander clearance is required for this operation.", "danger")
                return redirect(url_for("ops_views.render_command_deck"))
                
            return view_func(*args, **kwargs)
        return wrapper
    return decorator
