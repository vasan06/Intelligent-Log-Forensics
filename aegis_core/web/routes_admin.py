"""Admin routes"""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from aegis_core.config import Settings
from aegis_core.persistence.engine import get_db
from aegis_core.security.identity import admin_required, get_current_user
from werkzeug.security import generate_password_hash

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.route("/")
@admin_required
def dashboard():
    user = get_current_user()
    with get_db() as conn:
        total_users = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
        active_users = conn.execute("SELECT COUNT(*) c FROM users WHERE is_active = 1").fetchone()["c"]
        total_files = conn.execute("SELECT COUNT(*) c FROM log_files").fetchone()["c"]
        total_records = conn.execute("SELECT COUNT(*) c FROM log_records").fetchone()["c"]
        total_threats = conn.execute("SELECT COUNT(*) c FROM threats").fetchone()["c"]
        total_incidents = conn.execute("SELECT COUNT(*) c FROM incidents").fetchone()["c"]
        critical_incidents = conn.execute("SELECT COUNT(*) c FROM incidents WHERE severity = 'Critical' AND status NOT IN ('resolved','closed')").fetchone()["c"]
        processing_failures = conn.execute("SELECT COUNT(*) c FROM log_files WHERE status = 'failed'").fetchone()["c"]

        recent_users = conn.execute(
            "SELECT user_id, name, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 10"
        ).fetchall()

        recent_files = conn.execute(
            """SELECT f.file_id, f.filename, f.status, f.record_count, f.threat_count, f.uploaded_at, u.email
               FROM log_files f JOIN users u ON u.user_id = f.user_id
               ORDER BY f.uploaded_at DESC LIMIT 10"""
        ).fetchall()

        recent_audit = conn.execute(
            """SELECT a.action, a.detail, a.ip_address, a.created_at, u.email
               FROM audit_log a LEFT JOIN users u ON u.user_id = a.user_id
               ORDER BY a.created_at DESC LIMIT 20"""
        ).fetchall()

        severity_dist = conn.execute(
            "SELECT severity, COUNT(*) c FROM threats GROUP BY severity"
        ).fetchall()

    return render_template("admin/dashboard.html",
                           user=user,
                           stats={
                               "total_users": total_users,
                               "active_users": active_users,
                               "total_files": total_files,
                               "total_records": total_records,
                               "total_threats": total_threats,
                               "total_incidents": total_incidents,
                               "critical_incidents": critical_incidents,
                               "processing_failures": processing_failures,
                               "severity_dist": {r["severity"]: r["c"] for r in severity_dist},
                           },
                           recent_users=[dict(u) for u in recent_users],
                           recent_files=[dict(f) for f in recent_files],
                           recent_audit=[dict(a) for a in recent_audit])


@admin_bp.route("/users")
@admin_required
def users():
    user = get_current_user()
    search = request.args.get("q", "")
    role_filter = request.args.get("role", "")

    with get_db() as conn:
        query = "SELECT user_id, name, email, role, is_active, created_at, last_login FROM users WHERE 1=1"
        params = []
        if search:
            query += " AND (name LIKE ? OR email LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        if role_filter:
            query += " AND role = ?"
            params.append(role_filter)
        query += " ORDER BY created_at DESC"
        user_list = conn.execute(query, params).fetchall()

    return render_template("admin/users.html",
                           user=user,
                           users=[dict(u) for u in user_list],
                           search=search,
                           role_filter=role_filter)


@admin_bp.route("/users/<int:target_id>/toggle", methods=["POST"])
@admin_required
def toggle_user(target_id: int):
    user = get_current_user()
    if target_id == user.user_id:
        flash("You cannot deactivate your own account.", "error")
        return redirect(url_for("admin.users"))

    with get_db() as conn:
        target = conn.execute("SELECT is_active, email FROM users WHERE user_id = ?", (target_id,)).fetchone()
        if target:
            new_state = 0 if target["is_active"] else 1
            conn.execute("UPDATE users SET is_active = ? WHERE user_id = ?", (new_state, target_id))
            state_label = "activated" if new_state else "deactivated"
            conn.execute(
                "INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?,?,?,?)",
                (user.user_id, "user_toggle", f"{target['email']} {state_label}", Settings.now_utc())
            )
            flash(f"User account {state_label}.", "success")

    return redirect(url_for("admin.users"))


@admin_bp.route("/users/<int:target_id>/role", methods=["POST"])
@admin_required
def change_role(target_id: int):
    user = get_current_user()
    new_role = request.form.get("role")
    if new_role not in ("analyst", "admin"):
        flash("Invalid role.", "error")
        return redirect(url_for("admin.users"))

    with get_db() as conn:
        target = conn.execute("SELECT email FROM users WHERE user_id = ?", (target_id,)).fetchone()
        if target:
            conn.execute("UPDATE users SET role = ? WHERE user_id = ?", (new_role, target_id))
            conn.execute(
                "INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?,?,?,?)",
                (user.user_id, "role_change", f"{target['email']} → {new_role}", Settings.now_utc())
            )
            flash(f"Role updated to {new_role}.", "success")

    return redirect(url_for("admin.users"))


@admin_bp.route("/audit-log")
@admin_required
def audit_log():
    user = get_current_user()
    with get_db() as conn:
        logs = conn.execute(
            """SELECT a.audit_id, a.action, a.detail, a.ip_address, a.created_at, u.email, u.name
               FROM audit_log a LEFT JOIN users u ON u.user_id = a.user_id
               ORDER BY a.created_at DESC LIMIT 200"""
        ).fetchall()
    return render_template("admin/audit_log.html", user=user, logs=[dict(l) for l in logs])


@admin_bp.route("/incidents")
@admin_required
def incidents():
    user = get_current_user()
    with get_db() as conn:
        incident_list = conn.execute(
            """SELECT i.incident_id, i.title, i.severity, i.status, i.category,
                      i.confidence, i.created_at, f.filename, u.email
               FROM incidents i
               JOIN log_files f ON f.file_id = i.file_id
               JOIN users u ON u.user_id = f.user_id
               ORDER BY i.created_at DESC"""
        ).fetchall()
    return render_template("admin/incidents.html", user=user, incidents=[dict(i) for i in incident_list])
