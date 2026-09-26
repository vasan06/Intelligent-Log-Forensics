import base64
from dataclasses import dataclass
from functools import wraps
import hashlib
import hmac
import json
import secrets
import time
from typing import Callable, Optional

from flask import flash, redirect, request, session, url_for

from aegis_core.config import Settings
from aegis_core.persistence.engine import get_db


@dataclass
class User:
    user_id: int
    name: str
    email: str
    role: str
    is_active: bool = True

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def display_role(self) -> str:
        return "Administrator" if self.is_admin else "Analyst"


def create_session_token(user_id: int, role: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + Settings.SESSION_LIFETIME_SECONDS,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode()
    b64 = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    sig = hmac.new(
        Settings.TOKEN_KEY.encode(), b64.encode(), hashlib.sha256
    ).hexdigest()
    return f"{b64}.{sig}"


def verify_session_token(token: str | None) -> Optional[int]:
    if not token or "." not in token:
        return None
    parts = token.rsplit(".", 1)
    if len(parts) != 2:
        return None
    b64, sig = parts
    expected = hmac.new(
        Settings.TOKEN_KEY.encode(), b64.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        padding = "=" * (-len(b64) % 4)
        data = json.loads(base64.urlsafe_b64decode(b64 + padding))
    except Exception:
        return None
    if data.get("exp", 0) < int(time.time()):
        return None
    return data.get("sub")


def get_current_user() -> Optional[User]:
    user_id = session.get("user_id") or verify_session_token(
        request.cookies.get("ilf_session")
    )
    if not user_id:
        return None
    with get_db() as conn:
        row = conn.execute(
            "SELECT user_id, name, email, role, is_active FROM users WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        if row and row["is_active"]:
            return User(
                user_id=row["user_id"],
                name=row["name"],
                email=row["email"],
                role=row["role"],
                is_active=bool(row["is_active"]),
            )
    return None


def login_required(f: Callable) -> Callable:
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            flash("Please sign in to continue.", "warning")
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return wrapper


def admin_required(f: Callable) -> Callable:
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            flash("Please sign in to continue.", "warning")
            return redirect(url_for("auth.login"))
        if not user.is_admin:
            flash("Administrator access required.", "danger")
            return redirect(url_for("app.dashboard"))
        return f(*args, **kwargs)
    return wrapper


def create_reset_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash)"""
    raw = secrets.token_urlsafe(32)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h


# Keep backward compat
def resolve_active_operator():
    return get_current_user()

def require_clearance(tier: str = "Analyst"):
    if tier.lower() == "commander":
        return admin_required
    return login_required

def issue_access_ticket(user_id: int, role: str) -> str:
    return create_session_token(user_id, role)
