from aegis_core.security.identity import (
    User,
    get_current_user,
    login_required,
    admin_required,
    create_session_token,
    verify_session_token,
    create_reset_token,
    # backward compat aliases
    issue_access_ticket,
    require_clearance,
    resolve_active_operator,
)

# Backward compat alias
OperatorContext = User
verify_access_ticket = verify_session_token

__all__ = [
    "User", "OperatorContext",
    "get_current_user", "resolve_active_operator",
    "login_required", "admin_required",
    "create_session_token", "verify_session_token",
    "create_reset_token",
    "issue_access_ticket", "require_clearance", "verify_access_ticket",
]
