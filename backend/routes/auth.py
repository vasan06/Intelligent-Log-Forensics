
"""
ILF Authentication Routes
PostgreSQL + bcrypt + JWT.
OTP/SMTP removed for now.
"""

import time

import bcrypt
import jwt
from flask import Blueprint, request, jsonify

from backend.config import Config
from backend.database import get_db
from backend.models.user import User

auth_bp = Blueprint("auth", __name__)


# =========================================================
# JWT
# =========================================================

def _make_token(user) -> str:
    """
    Create JWT token from a SQLAlchemy User object.
    """

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "iat": int(time.time()),
        "exp": int(time.time()) + Config.JWT_ACCESS_EXPIRES,
    }

    return jwt.encode(
        payload,
        Config.JWT_SECRET_KEY,
        algorithm=Config.JWT_ALGORITHM,
    )


def verify_token(token):
    """
    Verify and decode JWT token.
    Returns payload if valid, otherwise None.
    """

    try:
        return jwt.decode(
            token,
            Config.JWT_SECRET_KEY,
            algorithms=[Config.JWT_ALGORITHM],
        )

    except jwt.ExpiredSignatureError:
        return None

    except jwt.InvalidTokenError:
        return None


# =========================================================
# SAFE USER
# =========================================================

def _safe_user(user):
    """
    Return user information safe to send to frontend.
    Never expose password_hash.
    """

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "verified": user.verified,
    }


# =========================================================
# LOGIN
# =========================================================

@auth_bp.route("/auth/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # -----------------------------------------------------
    # Validation
    # -----------------------------------------------------

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required",
        }), 400

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    with get_db() as db:

        user = db.query(User).filter(
            User.email == email
        ).first()

        if not user:
            return jsonify({
                "success": False,
                "message": "Invalid email or password",
            }), 401

        # -------------------------------------------------
        # Verification
        # -------------------------------------------------

        if not user.verified:
            return jsonify({
                "success": False,
                "message": "Account is not verified",
            }), 403

        # -------------------------------------------------
        # Password
        # -------------------------------------------------

        try:
            password_valid = bcrypt.checkpw(
                password.encode("utf-8"),
                user.password_hash.encode("utf-8"),
            )
        except (ValueError, TypeError):
            password_valid = False

        if not password_valid:
            return jsonify({
                "success": False,
                "message": "Invalid email or password",
            }), 401

        # -------------------------------------------------
        # Create JWT
        # -------------------------------------------------

        token = _make_token(user)

        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": token,
            "user": _safe_user(user),
        }), 200


# =========================================================
# SIGNUP
# =========================================================

@auth_bp.route("/auth/signup", methods=["POST"])
def signup():

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # -----------------------------------------------------
    # Validation
    # -----------------------------------------------------

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "Name, email and password are required",
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters",
        }), 400

    # -----------------------------------------------------
    # Database
    # -----------------------------------------------------

    with get_db() as db:

        existing_user = db.query(User).filter(
            User.email == email
        ).first()

        if existing_user:
            return jsonify({
                "success": False,
                "message": "An account with this email already exists",
            }), 409

        # -------------------------------------------------
        # Hash password
        # -------------------------------------------------

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")

        # -------------------------------------------------
        # Create user
        # -------------------------------------------------

        user = User(
            name=name,
            email=email,
            password_hash=password_hash,
            role="Analyst",
            verified=True,
        )

        db.add(user)

        # Make sure generated ID is available
        db.flush()

        # -------------------------------------------------
        # IMPORTANT:
        # Pass the actual User object to _make_token().
        # Do NOT pass a dictionary.
        # -------------------------------------------------

        token = _make_token(user)

        return jsonify({
            "success": True,
            "message": "Account created successfully",
            "token": token,
            "user": _safe_user(user),
        }), 201


# =========================================================
# LOGOUT
# =========================================================

@auth_bp.route("/auth/logout", methods=["POST"])
def logout():

    return jsonify({
        "success": True,
        "message": "Logged out successfully",
    }), 200
