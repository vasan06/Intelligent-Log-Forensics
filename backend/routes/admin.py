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
from backend.models.report import reports

try:
    from backend.models.log_analysis import LogAnalysis
    from backend.models.uploaded_file import UploadedFile
except ImportError:
    pass

admin_bp = Blueprint("admin", __name__)

ALLOWED_ROLES = {"User", "Admin"}
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
            return db.execute(select(users).where(users.c.id == str(payload.get("sub")), users.c.verified.is_(True))).mappings().first()
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
    role = str(data.get("role") or "User").strip().title()
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
        if values.get("verified") is False:
            db.execute(
                update(sessions)
                .where(sessions.c.user_id == str(uid), sessions.c.revoked_at.is_(None))
                .values(revoked_at=datetime.datetime.now(datetime.timezone.utc))
            )
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


@admin_bp.route("/admin/logs", methods=["GET"])
def all_logs():
    admin, error = require_admin()
    if error:
        return error
    
    q = (request.args.get("q") or "").strip().lower()
    sev = (request.args.get("severity") or "all").strip().upper()
    target_uid = (request.args.get("user_id") or "").strip()
    source_filter = (request.args.get("source") or "all").strip().lower()
    limit = min(max(int(request.args.get("limit", 100)), 1), 500)

    log_entries = []
    with get_db() as db:
        query = select(
            log_analyses.c.id,
            log_analyses.c.user_id,
            log_analyses.c.file_id,
            log_analyses.c.status,
            log_analyses.c.results,
            log_analyses.c.created_at,
            users.c.name.label("user_name"),
            users.c.email.label("user_email"),
            uploaded_files.c.filename,
        ).select_from(
            log_analyses.join(users, users.c.id == log_analyses.c.user_id)
            .outerjoin(uploaded_files, uploaded_files.c.id == log_analyses.c.file_id)
        ).order_by(log_analyses.c.created_at.desc())

        if target_uid:
            query = query.where(log_analyses.c.user_id == target_uid)

        rows = db.execute(query.limit(50)).mappings().all()

        for r in rows:
            results = r["results"] or {}
            user_label = f"{r['user_name']} ({r['user_email']})"
            is_sim = not bool(r["file_id"]) or (results.get("source") == "simulation")
            src_type = ("Simulation: " + str(results.get("scenario_name", "Scenario"))) if is_sim else (r["filename"] or "Uploaded Log")
            
            if source_filter != "all":
                if source_filter == "simulation" and not is_sim:
                    continue
                if source_filter == "upload" and is_sim:
                    continue

            raw_logs = results.get("logs") or results.get("preview") or []
            if not raw_logs and "ml" in results and isinstance(results["ml"], dict):
                raw_logs = results["ml"].get("flagged_entries") or []

            for entry in raw_logs:
                if not isinstance(entry, dict):
                    continue
                entry_sev = str(entry.get("severity") or "INFO").upper()
                if sev != "ALL" and entry_sev != sev:
                    continue
                msg = str(entry.get("message") or "")
                src_name = str(entry.get("source") or src_type)
                if q and (q not in msg.lower() and q not in src_name.lower() and q not in user_label.lower()):
                    continue
                
                log_entries.append({
                    "analysis_id": str(r["id"]),
                    "user_id": str(r["user_id"]),
                    "user_name": r["user_name"],
                    "user_email": r["user_email"],
                    "activity_source": src_type,
                    "is_simulation": is_sim,
                    "timestamp": entry.get("timestamp") or (r["created_at"].isoformat() if r["created_at"] else None),
                    "severity": entry_sev,
                    "source": src_name,
                    "ip": entry.get("ip") or "-",
                    "pid": entry.get("pid") or "-",
                    "message": msg,
                })
                if len(log_entries) >= limit:
                    break
            if len(log_entries) >= limit:
                break

    return jsonify({
        "success": True,
        "logs": log_entries,
        "total": len(log_entries),
    })


@admin_bp.route("/admin/users/<uid>/activity", methods=["GET"])
def user_activity(uid):
    admin, error = require_admin()
    if error:
        return error

    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(uid))).mappings().first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        files = db.execute(
            select(uploaded_files).where(uploaded_files.c.user_id == str(uid)).order_by(uploaded_files.c.created_at.desc())
        ).mappings().all()

        analyses = db.execute(
            select(
                log_analyses.c.id,
                log_analyses.c.file_id,
                log_analyses.c.status,
                log_analyses.c.results,
                log_analyses.c.created_at,
                uploaded_files.c.filename,
            ).select_from(
                log_analyses.outerjoin(uploaded_files, uploaded_files.c.id == log_analyses.c.file_id)
            ).where(log_analyses.c.user_id == str(uid)).order_by(log_analyses.c.created_at.desc())
        ).mappings().all()

        user_reports = db.execute(
            select(reports).where(reports.c.user_id == str(uid)).order_by(reports.c.created_at.desc())
        ).mappings().all()

        user_sessions = db.execute(
            select(sessions).where(sessions.c.user_id == str(uid)).order_by(sessions.c.expires_at.desc())
        ).mappings().all()

    analyses_data = []
    simulations_count = 0
    uploads_count = len(files)

    for a in analyses:
        res = a["results"] or {}
        is_sim = not bool(a["file_id"]) or (res.get("source") == "simulation")
        if is_sim:
            simulations_count += 1
        
        ml = res.get("ml") or res.get("ml_analysis") or {}
        analyses_data.append({
            "id": str(a["id"]),
            "file_id": str(a["file_id"]) if a["file_id"] else None,
            "filename": ("Simulation: " + str(res.get("scenario_name", "Scenario"))) if is_sim else (a["filename"] or "Uploaded Log"),
            "is_simulation": is_sim,
            "status": a["status"],
            "total_logs": int(res.get("total_logs", res.get("lines_parsed", 0)) or 0),
            "anomalies": int(res.get("anomalies", res.get("anomalies_found", 0)) or 0),
            "risk_level": ml.get("risk_level", "LOW"),
            "anomaly_score": ml.get("anomaly_score", 0),
            "created_at": a["created_at"].isoformat() if a["created_at"] else None,
        })

    now = datetime.datetime.now(datetime.timezone.utc)
    active_sess_count = 0
    for s in user_sessions:
        if s["revoked_at"] is None:
            exp = s["expires_at"]
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=datetime.timezone.utc)
            if exp > now:
                active_sess_count += 1

    return jsonify({
        "success": True,
        "user": safe_user(user),
        "summary": {
            "total_files": uploads_count,
            "total_analyses": len(analyses),
            "total_simulations": simulations_count,
            "total_reports": len(user_reports),
            "active_sessions": active_sess_count,
        },
        "files": [{
            "id": str(f["id"]),
            "filename": f["filename"],
            "size": f["size"],
            "db_location": f.get("db_location") or f"db://users/{uid}/uploads/{f['id']}",
            "status": f["status"],
            "created_at": f["created_at"].isoformat() if f["created_at"] else None,
        } for f in files],
        "analyses": analyses_data,
        "reports": [{
            "id": str(r["id"]),
            "report_type": r["report_type"],
            "analysis_id": str(r["analysis_id"]),
            "db_location": r.get("db_location") or f"db://users/{uid}/reports/{r['id']}",
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        } for r in user_reports],
    })


@admin_bp.route("/admin/system-health", methods=["GET"])
def system_health():
    admin, error = require_admin()
    if error:
        return error

    now = datetime.datetime.now(datetime.timezone.utc)
    with get_db() as db:
        users_count = db.execute(select(func.count()).select_from(users)).scalar_one()
        files_count = db.execute(select(func.count()).select_from(uploaded_files)).scalar_one()
        analyses_count = db.execute(select(func.count()).select_from(log_analyses)).scalar_one()
        sessions_count = db.execute(select(func.count()).select_from(sessions)).scalar_one()
        active_sessions = db.execute(
            select(func.count()).select_from(sessions).where(sessions.c.revoked_at.is_(None), sessions.c.expires_at > now)
        ).scalar_one()
        reports_count = db.execute(select(func.count()).select_from(reports)).scalar_one()

    return jsonify({
        "success": True,
        "database": {
            "status": "connected",
            "dialect": "PostgreSQL",
            "tables": {
                "users": users_count,
                "uploaded_files": files_count,
                "log_analyses": analyses_count,
                "sessions": sessions_count,
                "reports": reports_count,
            },
            "active_sessions": active_sessions,
            "storage_mode": "PostgreSQL In-DB BYTEA Storage (Zero Temporary Disk Write)",
        },
        "system": {
            "status": "operational",
            "timestamp": now.isoformat(),
            "server": "Intelligent Log Forensics Backend (Flask/SQLAlchemy)",
        }
    })


@admin_bp.route("/admin/users/<uid>/revoke-sessions", methods=["POST"])
def revoke_user_sessions(uid):
    admin, error = require_admin()
    if error:
        return error

    now = datetime.datetime.now(datetime.timezone.utc)
    with get_db() as db:
        user = db.execute(select(users).where(users.c.id == str(uid))).mappings().first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        res = db.execute(
            update(sessions).where(sessions.c.user_id == str(uid), sessions.c.revoked_at.is_(None)).values(revoked_at=now)
        )
        revoked_count = res.rowcount

    return jsonify({
        "success": True,
        "message": f"Successfully revoked {revoked_count} active session(s) for user {user['name']}.",
        "revoked_count": revoked_count
    })

import os

@admin_bp.route("/api/admin/activity", methods=["GET"])
def api_admin_activity():
    admin, error = require_admin()
    if error:
        return error
    try:
        with get_db() as db:
            query = select(
                log_analyses.c.id,
                log_analyses.c.created_at,
                log_analyses.c.results,
                users.c.email.label("user_email"),
                uploaded_files.c.filename
            ).select_from(
                log_analyses.join(users, users.c.id == log_analyses.c.user_id)
                .outerjoin(uploaded_files, uploaded_files.c.id == log_analyses.c.file_id)
            ).order_by(log_analyses.c.created_at.desc()).limit(50)
            rows = db.execute(query).mappings().all()
            
            results = []
            for r in rows:
                res = r["results"] or {}
                results.append({
                    "user_email": r["user_email"],
                    "filename": r["filename"] or "Simulation",
                    "total_entries": int(res.get("total_logs", res.get("lines_parsed", 0)) or 0),
                    "threats_found": int(res.get("anomalies", res.get("anomalies_found", 0)) or 0),
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None
                })
        return jsonify({"success": True, "activity": results})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route("/api/admin/system-health", methods=["GET"])
def api_admin_system_health():
    admin, error = require_admin()
    if error:
        return error
    try:
        with get_db() as db:
            total_users = db.execute(select(func.count()).select_from(users)).scalar_one()
            total_analyses = db.execute(select(func.count()).select_from(log_analyses)).scalar_one()
            total_files = db.execute(select(func.count()).select_from(uploaded_files)).scalar_one()
            total_storage = db.execute(select(func.sum(uploaded_files.c.size)).select_from(uploaded_files)).scalar() or 0
            
            db_size = 0
            db_uri = getattr(config, "SQLALCHEMY_DATABASE_URI", getattr(config, "DATABASE_URI", ""))
            if db_uri and db_uri.startswith("sqlite"):
                db_path = db_uri.replace("sqlite:///", "")
                if os.path.exists(db_path):
                    db_size = os.path.getsize(db_path)
            
        return jsonify({
            "success": True,
            "total_users": total_users,
            "total_analyses": total_analyses,
            "total_uploaded_files": total_files,
            "total_storage_used": total_storage,
            "database_size": db_size
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@admin_bp.route("/api/admin/uploaded-logs", methods=["GET"])
def api_admin_uploaded_logs():
    admin, error = require_admin()
    if error:
        return error
    try:
        with get_db() as db:
            query = select(
                uploaded_files.c.filename,
                uploaded_files.c.size.label("file_size"),
                uploaded_files.c.created_at.label("uploaded_at"),
                users.c.email.label("user_email")
            ).select_from(
                uploaded_files.join(users, users.c.id == uploaded_files.c.user_id)
            ).order_by(uploaded_files.c.created_at.desc())
            rows = db.execute(query).mappings().all()
            
            results = []
            for r in rows:
                results.append({
                    "filename": r["filename"],
                    "user_email": r["user_email"],
                    "file_size": r["file_size"],
                    "uploaded_at": r["uploaded_at"].isoformat() if r["uploaded_at"] else None
                })
        return jsonify({"success": True, "logs": results})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
