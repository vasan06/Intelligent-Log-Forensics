"""
routes/auth.py — ILF Authentication Routes
JWT-based auth. OTP via email only — never in response body or logs.
Endpoints: login, signup, verify-otp, resend-otp, forgot-password, reset-password, logout
"""
import jwt, time, logging
from flask import Blueprint, request, jsonify
from backend.config import Config
from backend.services.otp_service import issue_otp, verify_otp

auth_bp = Blueprint('auth', __name__)
log     = logging.getLogger('ilf.auth')

# ── In-memory user store (replace with DB in prod) ──
_USERS: dict = {
    'admin@ilf.io': {
        'id': 'u1', 'name': 'Admin User', 'email': 'admin@ilf.io',
        'password': 'ilf2026',   # plain for demo; use bcrypt in prod
        'role': 'Admin', 'verified': True,
    }
}
_PENDING: dict = {}   # email → {name, password} awaiting OTP verify

def _make_token(user: dict) -> str:
    payload = {
        'sub':   user['id'],
        'email': user['email'],
        'role':  user['role'],
        'iat':   int(time.time()),
        'exp':   int(time.time()) + Config.JWT_ACCESS_EXPIRES,
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)

def _safe_user(u: dict) -> dict:
    """Return user dict safe to include in response (no password)."""
    return {k: v for k, v in u.items() if k != 'password'}

def verify_token(token: str) -> dict | None:
    """Decode and verify JWT. Returns payload or None."""
    try:
        return jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# ── Login ────────────────────────────────────────
@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data  = request.json or {}
    email = (data.get('email') or '').lower().strip()
    pw    = data.get('password') or ''

    user = _USERS.get(email)
    if not user or user['password'] != pw:
        log.info('Login failed for %s', email)
        return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

    if not user.get('verified'):
        return jsonify({'success': False, 'message': 'Account not verified. Check your email for OTP.'}), 403

    token = _make_token(user)
    log.info('Login success for %s', email)
    return jsonify({'success': True, 'token': token, 'user': _safe_user(user)})

# ── Signup ───────────────────────────────────────
@auth_bp.route('/auth/signup', methods=['POST'])
def signup():
    data  = request.json or {}
    email = (data.get('email') or '').lower().strip()
    name  = (data.get('name')  or '').strip()
    pw    = data.get('password') or ''

    if not all([email, name, pw]):
        return jsonify({'success': False, 'message': 'Name, email and password are required'}), 400
    if email in _USERS:
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 409
    if len(pw) < 8:
        return jsonify({'success': False, 'message': 'Password must be at least 8 characters'}), 400

    _PENDING[email] = {'name': name, 'password': pw}
    sent = issue_otp(email, 'signup')
    if not sent:
        return jsonify({'success': False, 'message': 'Failed to send verification email'}), 500

    log.info('Signup OTP issued for %s', email)
    return jsonify({'success': True, 'message': 'Verification code sent to your email', 'email': email})

# ── Verify OTP ───────────────────────────────────
@auth_bp.route('/auth/verify-otp', methods=['POST'])
def verify_otp_route():
    data     = request.json or {}
    email    = (data.get('email') or '').lower().strip()
    otp_type = data.get('type') or 'signup'
    # submitted OTP — NEVER log this value
    submitted = str(data.get('otp') or '').strip()

    ok, reason = verify_otp(email, submitted, otp_type)
    if not ok:
        return jsonify({'success': False, 'message': reason}), 400

    if otp_type == 'signup':
        pending = _PENDING.pop(email, None)
        if not pending:
            return jsonify({'success': False, 'message': 'Signup session expired'}), 400
        import uuid
        user = {
            'id': str(uuid.uuid4())[:8], 'name': pending['name'],
            'email': email, 'password': pending['password'],
            'role': 'Analyst', 'verified': True,
        }
        _USERS[email] = user
        token = _make_token(user)
        return jsonify({'success': True, 'token': token, 'user': _safe_user(user)})

    # reset type — just confirm OTP was valid
    return jsonify({'success': True, 'message': 'OTP verified'})

# ── Resend OTP ───────────────────────────────────
@auth_bp.route('/auth/resend-otp', methods=['POST'])
def resend_otp():
    data     = request.json or {}
    email    = (data.get('email') or '').lower().strip()
    otp_type = data.get('type') or 'signup'
    sent     = issue_otp(email, otp_type)
    if not sent:
        return jsonify({'success': False, 'message': 'Failed to send OTP'}), 500
    return jsonify({'success': True, 'message': 'New OTP sent to your email'})

# ── Forgot password ──────────────────────────────
@auth_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    data  = request.json or {}
    email = (data.get('email') or '').lower().strip()
    # Always respond OK — don't reveal if email exists (security)
    if email in _USERS:
        issue_otp(email, 'reset')
        log.info('Password reset OTP issued for %s', email)
    return jsonify({'success': True, 'message': 'If that email is registered, a reset code has been sent'})

# ── Reset password ───────────────────────────────
@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data     = request.json or {}
    email    = (data.get('email') or '').lower().strip()
    submitted = str(data.get('otp') or '').strip()  # NEVER logged
    new_pw   = data.get('new_password') or ''

    if len(new_pw) < 8:
        return jsonify({'success': False, 'message': 'Password must be at least 8 characters'}), 400

    ok, reason = verify_otp(email, submitted, 'reset')
    if not ok:
        return jsonify({'success': False, 'message': reason}), 400

    if email not in _USERS:
        return jsonify({'success': False, 'message': 'Account not found'}), 404

    _USERS[email]['password'] = new_pw
    log.info('Password reset successful for %s', email)
    return jsonify({'success': True, 'message': 'Password updated. You can now log in.'})

# ── Logout ───────────────────────────────────────
@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    # JWT is stateless — client discards token
    return jsonify({'success': True})
