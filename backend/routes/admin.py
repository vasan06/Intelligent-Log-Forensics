"""Admin API: real database users, roles, global statistics, and CRUD."""
import datetime
import jwt
from flask import Blueprint, request, jsonify
from sqlalchemy import select, update, delete, func
from backend import config
from backend.database import get_db
from backend.models.user import users
from backend.models.uploaded_file import uploaded_files
from backend.models.log_analysis import log_analyses
from backend.models.session import sessions

admin_bp = Blueprint("admin", __name__)

ALLOWED_ROLES = {"Analyst", "Viewer", "Admin"}
ALLOWED_STATUS = {"active", "inactive"}

def current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    try:
        payload = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        with get_db() as db:
            return db.execute(select(users).where(users.c.id == str(payload.get("sub")))).mappings().first()
    except jwt.InvalidTokenError:
        return None

def require_admin():
    user = current_user()
    if not user:
        return None, (jsonify({"success": False, "message": "Authentication required"}), 401)
    if str(user["role"]).lower() != "admin":
        return None, (jsonify({"success": False, "message": "Admin access required"}), 403)
    return user, None

def safe_user(user):
    name = user["name"] or ""
    return {
        "id": str(user["id"]),
        "name": name,
        "email": user["email"],
        "role": user["role"],
        "status": "active" if user["verified"] else "inactive",
        "verified": bool(user["verified"]),
        "created_at": user["created_at"].isoformat() if user["created_at"] else None,
        "avatar": "".join(x[0] for x in name.split() if x)[:2].upper(),
    }

@admin_bp.route("/admin/stats", methods=["GET"])
def stats():
    _, error = require_admin()
    if error:
        return error
    with get_db() as db:
        total_users = db.execute(select(func.count()).select_from(users)).scalar_one()
        active_users = db.execute(select(func.count()).select_from(users).where(users.c.verified.is_(True))).scalar_one()
        total_files = db.execute(select(func.count()).select_from(uploaded_files)).scalar_one()
        total_analyses = db.execute(select(func.count()).select_from(log_analyses)).scalar_one()
        active_sessions = db.execute(
            select(func.count()).select_from(sessions).where(sessions.c.revoked_at.is_(None), sessions.c.expires_at > datetime.datetime.now(datetime.timezone.utc))
        ).scalar_one()
    return jsonify({
        "success": True,
        "scope": "global",
        "system_health": "operational",
        "total_users": total_users,
        "active_users": active_users,
        "total_files": total_files,
        "total_analyses": total_analyses,
        "active_sessions": active_sessions,
    })

@admin_bp.route("/admin/users", methods=["GET"])
def users_list():
    _, error = require_admin()
    if error:
        return error
    with get_db() as db:
        rows = db.execute(select(users).order_by(users.c.created_at.desc())).mappings().all()
    result = [safe_user(u) for u in rows]
    return jsonify({"success": True, "users": result, "total": len(result)})

@admin_bp.route("/admin/users", methods=["POST"])
def create_user():
    _, error = require_admin()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    name, email = str(data.get("name") or "").strip(), str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    role = str(data.get("role") or "Analyst").strip().title()
    if not name or not email or len(password) < 8:
        return jsonify({"success": False, "message": "Name, email and password (8+ characters) are required"}), 400
    if role not in ALLOWED_ROLES:
        return jsonify({"success": False, "message": "Invalid role"}), 400
    import bcrypt, uuid
    with get_db() as db:
        if db.execute(select(users).where(users.c.email == email)).mappings().first():
            return jsonify({"success": False, "message": "Email already exists"}), 409
        uid = str(uuid.uuid4())
        db.execute(users.insert().values(
            id=uid, name=name, email=email,
            password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
            role=role, verified=True
        ))
        user = db.execute(select(users).where(users.c.id == uid)).mappings().first()
    return jsonify({"success": True, "user": safe_user(user)}), 201

@admin_bp.route("/admin/users/<uid>", methods=["PUT"])
def update_user(uid):
    admin, error = require_admin()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    values = {}
    if "name" in data:
        name = str(data["name"]).strip()
        if not name:
            return jsonify({"success": False, "message": "Name cannot be empty"}), 400
        values["name"] = name
    if "email" in data:
        email = str(data["email"]).strip().lower()
        if not email:
            return jsonify({"success": False, "message": "Email cannot be empty"}), 400
        with get_db() as db:
            exists = db.execute(select(users).where(users.c.email == email, users.c.id != str(uid))).mappings().first()
            if exists:
                return jsonify({"success": False, "message": "Email already exists"}), 409
    if "email" in data:
        values["email"] = str(data["email"]).strip().lower()
    if "role" in data:
        role = str(data["role"]).strip().title()
        if role not in ALLOWED_ROLES:
            return jsonify({"success": False, "message": "Invalid role"}), 400
        if str(uid) == str(admin["id"]) and role != "Admin":
            return jsonify({"success": False, "message": "You cannot remove your own admin role"}), 400
        values["role"] = role
    if "status" in data:
        status = str(data["status"]).lower()
        if status not in ALLOWED_STATUS:
            return jsonify({"success": False, "message": "Invalid status"}), 400
        values["verified"] = status == "active"
        if str(uid) == str(admin["id"]) and not values["verified"]:
            return jsonify({"success": False, "message": "You cannot deactivate your own account"}), 400
    if not values:
        return jsonify({"success": False, "message": "No changes supplied"}), 400
    with get_db() as db:
        result = db.execute(update(users).where(users.c.id == str(uid)).values(**values))
        if result.rowcount == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
        user = db.execute(select(users).where(users.c.id == str(uid))).mappings().first()
    return jsonify({"success": True, "user": safe_user(user)})

@admin_bp.route("/admin/users/<uid>", methods=["DELETE"])
def delete_user(uid):
    admin, error = require_admin()
    if error:
        return error
    if str(uid) == str(admin["id"]):
        return jsonify({"success": False, "message": "You cannot delete your own account"}), 400
    with get_db() as db:
        result = db.execute(delete(users).where(users.c.id == str(uid)))
        if result.rowcount == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
    return jsonify({"success": True, "message": "User deleted"})
