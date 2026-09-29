"""
ILF Authentication Routes

PostgreSQL + bcrypt + JWT.
Access + refresh tokens.
Refresh-token rotation.
Session revocation.

Authentication cookies:
    access_token
    refresh_token
    session_id

Cookie lifetime:
    access_token  -> JWT_ACCESS_EXPIRES
    refresh_token -> JWT_REFRESH_EXPIRES
    session_id    -> JWT_REFRESH_EXPIRES
"""

import datetime
import hashlib
import uuid

import bcrypt
import jwt

from flask import Blueprint, jsonify, request

from sqlalchemy import select, update

from backend import config
from backend.database import get_db
from backend.models.session import sessions
from backend.models.user import users


auth_bp = Blueprint(
    "auth",
    __name__,
)


# =========================================================
# COOKIE CONFIGURATION
# =========================================================

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"
SESSION_COOKIE_NAME = "session_id"

ACCESS_COOKIE_MAX_AGE = int(
    config.JWT_ACCESS_EXPIRES
)

REFRESH_COOKIE_MAX_AGE = int(
    config.JWT_REFRESH_EXPIRES
)


# =========================================================
# JWT HELPERS
# =========================================================

def create_access_token(user):
    """
    Create a short-lived JWT access token.
    """

    now = datetime.datetime.now(
        datetime.timezone.utc
    )

    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "type": "access",
        "iat": now,
        "exp": now + datetime.timedelta(
            seconds=config.JWT_ACCESS_EXPIRES
        ),
    }

    return jwt.encode(
        payload,
        config.JWT_SECRET_KEY,
        algorithm=config.JWT_ALGORITHM,
    )


def create_refresh_token(user):
    """
    Create a long-lived JWT refresh token.
    """

    now = datetime.datetime.now(
        datetime.timezone.utc
    )

    payload = {
        "sub": str(user["id"]),
        "type": "refresh",
        "iat": now,
        "exp": now + datetime.timedelta(
            seconds=config.JWT_REFRESH_EXPIRES
        ),
    }

    return jwt.encode(
        payload,
        config.JWT_SECRET_KEY,
        algorithm=config.JWT_ALGORITHM,
    )


def verify_refresh_token(token):
    """
    Verify and decode a refresh token.

    Returns decoded payload when valid.
    Returns None when invalid or expired.
    """

    try:

        payload = jwt.decode(
            token,
            config.JWT_SECRET_KEY,
            algorithms=[
                config.JWT_ALGORITHM
            ],
        )

        if payload.get("type") != "refresh":
            return None

        return payload

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
    ):
        return None


def hash_refresh_token(token):
    """
    Hash refresh token before storing it
    in PostgreSQL.
    """

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def require_access_token(request):
    """
    Validate Bearer access token.

    This keeps compatibility with API clients
    that send:

        Authorization: Bearer <token>

    Returns decoded payload when valid.
    Returns None when authentication fails.
    """

    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if not authorization.startswith(
        "Bearer "
    ):
        return None

    token = authorization[
        7:
    ].strip()

    if not token:
        return None

    try:

        payload = jwt.decode(
            token,
            config.JWT_SECRET_KEY,
            algorithms=[
                config.JWT_ALGORITHM
            ],
        )

        if payload.get("type") != "access":
            return None

        return payload

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
    ):
        return None


# =========================================================
# COOKIE HELPERS
# =========================================================

def get_cookie_secure():
    """
    Determine whether authentication cookies should
    use the Secure attribute.

    HTTPS:
        Secure=True

    Local HTTP development:
        Secure=False

    If the config exposes a suitable value, use it.
    Otherwise default to False so localhost works.
    """

    if hasattr(config, "COOKIE_SECURE"):
        return bool(
            config.COOKIE_SECURE
        )

    if hasattr(config, "JWT_COOKIE_SECURE"):
        return bool(
            config.JWT_COOKIE_SECURE
        )

    return False


def set_auth_cookies(
    response,
    access_token,
    refresh_token,
    session_id,
):
    """
    Set the ILF authentication cookies.

    IMPORTANT:
        Exact cookie names are used:

            access_token
            refresh_token
            session_id

    No *_cookie suffix is used.

    Explicit max_age values ensure the browser
    does not display "Session".
    """

    secure = get_cookie_secure()

    # -----------------------------------------------------
    # ACCESS TOKEN
    # -----------------------------------------------------

    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=ACCESS_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path="/",
    )

    # -----------------------------------------------------
    # REFRESH TOKEN
    # -----------------------------------------------------

    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path="/",
    )

    # -----------------------------------------------------
    # SESSION ID
    # -----------------------------------------------------

    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path="/",
    )

    return response


def clear_auth_cookies(response):
    """
    Remove current authentication cookies.

    Also explicitly expires the old cookie names so
    stale cookies from the previous authentication
    implementation do not remain in the browser.
    """

    secure = get_cookie_secure()

    # -----------------------------------------------------
    # CURRENT COOKIE NAMES
    # -----------------------------------------------------

    response.delete_cookie(
        ACCESS_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite="Lax",
    )

    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite="Lax",
    )

    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite="Lax",
    )

    # -----------------------------------------------------
    # OLD COOKIE NAMES
    #
    # Remove cookies from the previous implementation.
    # -----------------------------------------------------

    response.delete_cookie(
        "access_token_cookie",
        path="/",
        secure=secure,
        samesite="Lax",
    )

    response.delete_cookie(
        "refresh_token_cookie",
        path="/",
        secure=secure,
        samesite="Lax",
    )

    return response


# =========================================================
# HELPERS
# =========================================================

def safe_user(user):
    """
    Return only safe user information.
    """

    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "verified": user["verified"],
    }


def create_session(
    db,
    user,
    refresh_token,
):
    """
    Create a persistent refresh-token session.
    """

    now = datetime.datetime.now(
        datetime.timezone.utc
    )

    expires_at = now + datetime.timedelta(
        seconds=config.JWT_REFRESH_EXPIRES
    )

    session_id = str(
        uuid.uuid4()
    )

    db.execute(
        sessions.insert().values(
            id=session_id,
            user_id=str(user["id"]),
            refresh_token_hash=hash_refresh_token(
                refresh_token
            ),
            expires_at=expires_at,
            revoked_at=None,
        )
    )

    return session_id


def revoke_session(
    db,
    session_id,
):
    """
    Revoke one refresh session.
    """

    db.execute(
        update(sessions)
        .where(
            sessions.c.id == session_id
        )
        .values(
            revoked_at=datetime.datetime.now(
                datetime.timezone.utc
            )
        )
    )


def revoke_all_sessions(
    db,
    user_id,
):
    """
    Revoke every active refresh session
    belonging to the specified user.
    """

    db.execute(
        update(sessions)
        .where(
            sessions.c.user_id == str(user_id),
            sessions.c.revoked_at.is_(None),
        )
        .values(
            revoked_at=datetime.datetime.now(
                datetime.timezone.utc
            )
        )
    )


def find_user_by_email(
    db,
    email,
):
    """
    Find a user by normalized email.
    """

    result = db.execute(
        select(users).where(
            users.c.email == email
        )
    )

    return result.mappings().first()


def find_user_by_id(
    db,
    user_id,
):
    """
    Find a user by ID.
    """

    result = db.execute(
        select(users).where(
            users.c.id == str(user_id)
        )
    )

    return result.mappings().first()


def issue_tokens(
    db,
    user,
):
    """
    Create a new access + refresh token pair
    and persist the refresh-token session.
    """

    access_token = create_access_token(
        user
    )

    refresh_token = create_refresh_token(
        user
    )

    session_id = create_session(
        db,
        user,
        refresh_token,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "session_id": session_id,
    }


# =========================================================
# SIGNUP
# =========================================================

@auth_bp.route(
    "/auth/signup",
    methods=["POST"],
)
def signup():

    data = request.get_json(
        silent=True
    ) or {}

    name = (
        data.get("name") or ""
    ).strip()

    email = (
        data.get("email") or ""
    ).strip().lower()

    password = (
        data.get("password") or ""
    )

    if (
        not name
        or not email
        or not password
    ):
        return jsonify(
            {
                "success": False,
                "message": (
                    "Name, email and password "
                    "are required"
                ),
            }
        ), 400

    if len(password) < 8:
        return jsonify(
            {
                "success": False,
                "message": (
                    "Password must be at least "
                    "8 characters"
                ),
            }
        ), 400

    with get_db() as db:

        existing_user = find_user_by_email(
            db,
            email,
        )

        if existing_user:

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "An account with this "
                        "email already exists"
                    ),
                }
            ), 409

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")

        user_id = str(
            uuid.uuid4()
        )

        db.execute(
            users.insert().values(
                id=user_id,
                name=name,
                email=email,
                password_hash=password_hash,
                role="Analyst",
                verified=True,
            )
        )

        user = find_user_by_id(
            db,
            user_id,
        )

        token_data = issue_tokens(
            db,
            user,
        )

        response = jsonify(
            {
                "success": True,
                "message": (
                    "Account created successfully"
                ),
                "access_token": token_data[
                    "access_token"
                ],
                "refresh_token": token_data[
                    "refresh_token"
                ],
                "token_type": "Bearer",
                "expires_in": (
                    config.JWT_ACCESS_EXPIRES
                ),
                "user": safe_user(user),
            }
        )

        set_auth_cookies(
            response,
            token_data["access_token"],
            token_data["refresh_token"],
            token_data["session_id"],
        )

        return response, 201


# =========================================================
# LOGIN
# =========================================================

@auth_bp.route(
    "/auth/login",
    methods=["POST"],
)
def login():

    data = request.get_json(
        silent=True
    ) or {}

    email = (
        data.get("email") or ""
    ).strip().lower()

    password = (
        data.get("password") or ""
    )

    if (
        not email
        or not password
    ):
        return jsonify(
            {
                "success": False,
                "message": (
                    "Email and password are required"
                ),
            }
        ), 400

    with get_db() as db:

        user = find_user_by_email(
            db,
            email,
        )

        if not user:

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "Invalid email or password"
                    ),
                }
            ), 401

        if not user["verified"]:

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "Account is not verified"
                    ),
                }
            ), 403

        try:

            valid = bcrypt.checkpw(
                password.encode("utf-8"),
                user[
                    "password_hash"
                ].encode("utf-8"),
            )

        except (
            ValueError,
            TypeError,
        ):

            valid = False

        if not valid:

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "Invalid email or password"
                    ),
                }
            ), 401

        token_data = issue_tokens(
            db,
            user,
        )

        response = jsonify(
            {
                "success": True,
                "message": (
                    "Login successful"
                ),
                "access_token": token_data[
                    "access_token"
                ],
                "refresh_token": token_data[
                    "refresh_token"
                ],
                "token_type": "Bearer",
                "expires_in": (
                    config.JWT_ACCESS_EXPIRES
                ),
                "user": safe_user(user),
            }
        )

        set_auth_cookies(
            response,
            token_data["access_token"],
            token_data["refresh_token"],
            token_data["session_id"],
        )

        return response, 200


# =========================================================
# REFRESH
# =========================================================

@auth_bp.route(
    "/auth/refresh",
    methods=["POST"],
)
def refresh():

    data = request.get_json(
        silent=True
    ) or {}

    # -----------------------------------------------------
    # Accept JSON refresh token first.
    #
    # Also accept the HttpOnly cookie.
    # -----------------------------------------------------

    refresh_token = (
        data.get("refresh_token")
        or request.cookies.get(
            REFRESH_COOKIE_NAME
        )
        or ""
    ).strip()

    if not refresh_token:

        return jsonify(
            {
                "success": False,
                "message": (
                    "Refresh token is required"
                ),
            }
        ), 401

    payload = verify_refresh_token(
        refresh_token
    )

    if not payload:

        return jsonify(
            {
                "success": False,
                "message": (
                    "Invalid or expired refresh token"
                ),
            }
        ), 401

    user_id = payload.get(
        "sub"
    )

    if not user_id:

        return jsonify(
            {
                "success": False,
                "message": (
                    "Invalid refresh token"
                ),
            }
        ), 401

    token_hash = hash_refresh_token(
        refresh_token
    )

    with get_db() as db:

        result = db.execute(
            select(sessions).where(
                sessions.c.user_id
                == str(user_id),
                sessions.c.refresh_token_hash
                == token_hash,
            )
        )

        session = (
            result.mappings().first()
        )

        if not session:

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "Refresh session not found"
                    ),
                }
            ), 401

        now = datetime.datetime.now(
            datetime.timezone.utc
        )

        if (
            session["revoked_at"]
            is not None
        ):

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "Refresh token has been revoked"
                    ),
                }
            ), 401

        expires_at = session[
            "expires_at"
        ]

        if expires_at.tzinfo is None:

            expires_at = (
                expires_at.replace(
                    tzinfo=datetime.timezone.utc
                )
            )

        if expires_at <= now:

            revoke_session(
                db,
                session["id"],
            )

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "Refresh token has expired"
                    ),
                }
            ), 401

        user = find_user_by_id(
            db,
            user_id,
        )

        if not user:

            revoke_session(
                db,
                session["id"],
            )

            return jsonify(
                {
                    "success": False,
                    "message": (
                        "User not found"
                    ),
                }
            ), 401

        # -------------------------------------------------
        # ROTATE REFRESH TOKEN
        # -------------------------------------------------

        revoke_session(
            db,
            session["id"],
        )

        new_access_token = (
            create_access_token(
                user
            )
        )

        new_refresh_token = (
            create_refresh_token(
                user
            )
        )

        new_session_id = create_session(
            db,
            user,
            new_refresh_token,
        )

        response = jsonify(
            {
                "success": True,
                "message": (
                    "Token refreshed"
                ),
                "access_token": (
                    new_access_token
                ),
                "refresh_token": (
                    new_refresh_token
                ),
                "token_type": "Bearer",
                "expires_in": (
                    config.JWT_ACCESS_EXPIRES
                ),
                "user": safe_user(user),
            }
        )

        set_auth_cookies(
            response,
            new_access_token,
            new_refresh_token,
            new_session_id,
        )

        return response, 200


# =========================================================
# LOGOUT CURRENT SESSION
# =========================================================

@auth_bp.route(
    "/auth/logout",
    methods=["POST"],
)
def logout():

    data = request.get_json(
        silent=True
    ) or {}

    refresh_token = (
        data.get("refresh_token")
        or request.cookies.get(
            REFRESH_COOKIE_NAME
        )
        or ""
    ).strip()

    if refresh_token:

        token_hash = hash_refresh_token(
            refresh_token
        )

        with get_db() as db:

            db.execute(
                update(sessions)
                .where(
                    sessions.c.refresh_token_hash
                    == token_hash,
                    sessions.c.revoked_at.is_(
                        None
                    ),
                )
                .values(
                    revoked_at=(
                        datetime.datetime.now(
                            datetime.timezone.utc
                        )
                    )
                )
            )

    response = jsonify(
        {
            "success": True,
            "message": (
                "Logged out successfully"
            ),
        }
    )

    clear_auth_cookies(
        response
    )

    return response, 200


# =========================================================
# LOGOUT ALL
# =========================================================

@auth_bp.route(
    "/auth/logout-all",
    methods=["POST"],
)
def logout_all():

    payload = require_access_token(
        request
    )

    # Also allow the access token to come
    # from the HttpOnly cookie.

    if not payload:

        access_token = request.cookies.get(
            ACCESS_COOKIE_NAME
        )

        if access_token:

            try:

                payload = jwt.decode(
                    access_token,
                    config.JWT_SECRET_KEY,
                    algorithms=[
                        config.JWT_ALGORITHM
                    ],
                )

                if (
                    payload.get("type")
                    != "access"
                ):
                    payload = None

            except (
                jwt.ExpiredSignatureError,
                jwt.InvalidTokenError,
            ):

                payload = None

    if not payload:

        return jsonify(
            {
                "success": False,
                "message": (
                    "Authentication required"
                ),
            }
        ), 401

    user_id = payload.get(
        "sub"
    )

    with get_db() as db:

        revoke_all_sessions(
            db,
            user_id,
        )

    response = jsonify(
        {
            "success": True,
            "message": (
                "All sessions have been logged out"
            ),
        }
    )

    clear_auth_cookies(
        response
    )

    return response, 200