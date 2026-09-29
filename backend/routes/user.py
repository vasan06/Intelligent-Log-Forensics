
"""
routes/user.py — User profile get/update

Uses the authenticated JWT user and PostgreSQL users table.
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import select, update

from backend.database import get_db
from backend.models.user import users
from backend.config import JWT_SECRET_KEY, JWT_ALGORITHM

import jwt


user_bp = Blueprint("user", __name__)


# =========================================================
# AUTHENTICATION HELPER
# =========================================================

def get_authenticated_user_id():
    """
    Extract and validate the authenticated user ID
    from the Bearer access token.

    Returns:
        user_id string when valid
        None when authentication fails
    """

    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()

    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        if payload.get("type") != "access":
            return None

        return payload.get("sub")

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
    ):
        return None


# =========================================================
# SAFE USER RESPONSE
# =========================================================

def safe_user(user):
    """
    Return only fields that are safe for the frontend.
    """

    name = user["name"] or ""

    initials = "".join(
        word[0]
        for word in name.split()
        if word
    )[:2].upper()

    return {
        "id": str(user["id"]),
        "name": name,
        "email": user["email"],
        "role": user["role"],
        "avatar": initials,
    }


# =========================================================
# GET PROFILE
# =========================================================

@user_bp.route(
    "/user/profile",
    methods=["GET"],
)
def get_profile():

    user_id = get_authenticated_user_id()

    if not user_id:
        return jsonify(
            {
                "success": False,
                "message": "Authentication required",
            }
        ), 401

    with get_db() as db:

        result = db.execute(
            select(users).where(
                users.c.id == str(user_id)
            )
        )

        user = result.mappings().first()

        if not user:
            return jsonify(
                {
                    "success": False,
                    "message": "User not found",
                }
            ), 404

        return jsonify(
            {
                "user": safe_user(user),
            }
        ), 200


# =========================================================
# UPDATE PROFILE
# =========================================================

@user_bp.route(
    "/user/profile",
    methods=["PUT"],
)
def update_profile():

    user_id = get_authenticated_user_id()

    if not user_id:
        return jsonify(
            {
                "success": False,
                "message": "Authentication required",
            }
        ), 401

    data = request.get_json(
        silent=True
    ) or {}

    name = data.get("name")
    email = data.get("email")

    values = {}

    if name is not None:
        name = str(name).strip()

        if not name:
            return jsonify(
                {
                    "success": False,
                    "message": "Name cannot be empty",
                }
            ), 400

        values["name"] = name

    if email is not None:
        email = str(email).strip().lower()

        if not email:
            return jsonify(
                {
                    "success": False,
                    "message": "Email cannot be empty",
                }
            ), 400

        values["email"] = email

    if not values:
        return jsonify(
            {
                "success": False,
                "message": "No profile changes supplied",
            }
        ), 400

    with get_db() as db:

        # -------------------------------------------------
        # Check that the requested email is not already
        # being used by another user.
        # -------------------------------------------------

        if "email" in values:

            existing = db.execute(
                select(users).where(
                    users.c.email == values["email"],
                    users.c.id != str(user_id),
                )
            ).mappings().first()

            if existing:
                return jsonify(
                    {
                        "success": False,
                        "message": (
                            "An account with this "
                            "email already exists"
                        ),
                    }
                ), 409

        # -------------------------------------------------
        # Update authenticated user only
        # -------------------------------------------------

        db.execute(
            update(users)
            .where(
                users.c.id == str(user_id)
            )
            .values(**values)
        )

        # -------------------------------------------------
        # Read updated user
        # -------------------------------------------------

        result = db.execute(
            select(users).where(
                users.c.id == str(user_id)
            )
        )

        user = result.mappings().first()

        if not user:
            return jsonify(
                {
                    "success": False,
                    "message": "User not found",
                }
            ), 404

        return jsonify(
            {
                "success": True,
                "message": "Profile updated successfully",
                "user": safe_user(user),
            }
        ), 200


@user_bp.route("/user/export", methods=["GET"])
def export_user_data():
    user_id = get_authenticated_user_id()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    from backend.models.uploaded_file import uploaded_files
    from backend.models.log_analysis import log_analyses
    from backend.models.report import reports
    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(user_id))).mappings().first()
        files = db.execute(select(uploaded_files).where(uploaded_files.c.user_id == str(user_id)).order_by(uploaded_files.c.created_at.desc())).mappings().all()
        analyses = db.execute(select(log_analyses).where(log_analyses.c.user_id == str(user_id)).order_by(log_analyses.c.created_at.desc())).mappings().all()
        report_rows = db.execute(select(reports).where(reports.c.user_id == str(user_id)).order_by(reports.c.created_at.desc())).mappings().all()
    return jsonify({
        "success": True,
        "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "user": safe_user(user),
        "files": [dict(x) for x in files],
        "analyses": [dict(x) for x in analyses],
        "reports": [dict(x) for x in report_rows],
    })
