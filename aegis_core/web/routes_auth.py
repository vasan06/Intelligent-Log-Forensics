"""Authentication routes: /login, /register, /logout, /forgot-password, /reset-password"""
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from flask import Blueprint, flash, redirect, render_template, request, session, url_for, current_app
from werkzeug.security import check_password_hash, generate_password_hash

from aegis_core.config import Settings
from aegis_core.persistence.engine import get_db
from aegis_core.security.identity import create_session_token, create_reset_token, get_current_user

auth_bp = Blueprint("auth", __name__)


def _audit(user_id, action, detail=None, ip=None):
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO audit_log (user_id, action, detail, ip_address, created_at) VALUES (?,?,?,?,?)",
                (user_id, action, detail, ip, Settings.now_utc())
            )
    except Exception:
        pass


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if get_current_user():
        return redirect(url_for("app.dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        with get_db() as conn:
            user = conn.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()

        if user and user["is_active"] and check_password_hash(user["password_hash"], password):
            session.clear()
            session["user_id"] = user["user_id"]
            session.permanent = True

            token = create_session_token(user["user_id"], user["role"])
            _audit(user["user_id"], "login", f"Sign in from {request.remote_addr}", request.remote_addr)

            with get_db() as conn:
                conn.execute(
                    "UPDATE users SET last_login = ? WHERE user_id = ?",
                    (Settings.now_utc(), user["user_id"])
                )

            resp = redirect(url_for("app.dashboard"))
            resp.set_cookie(
                "ilf_session", token,
                httponly=True, samesite="Lax",
                secure=Settings.SECURE_COOKIES,
                max_age=Settings.SESSION_LIFETIME_SECONDS
            )
            return resp

        flash("Invalid email or password.", "error")

    return render_template("auth/login.html")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if get_current_user():
        return redirect(url_for("app.dashboard"))

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        errors = []
        if not name or len(name) < 2:
            errors.append("Full name must be at least 2 characters.")
        if not email or "@" not in email:
            errors.append("Enter a valid email address.")
        if len(password) < 8:
            errors.append("Password must be at least 8 characters.")
        if password != confirm:
            errors.append("Passwords do not match.")

        if errors:
            for e in errors:
                flash(e, "error")
            return render_template("auth/register.html", form={"name": name, "email": email})

        try:
            with get_db() as conn:
                existing = conn.execute(
                    "SELECT user_id FROM users WHERE email = ?", (email,)
                ).fetchone()
                if existing:
                    flash("An account with this email already exists.", "error")
                    return render_template("auth/register.html", form={"name": name, "email": email})

                conn.execute(
                    "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?,?,?,?,?)",
                    (name, email, generate_password_hash(password), "analyst", Settings.now_utc())
                )
            _audit(None, "register", f"New account: {email}", request.remote_addr)
            flash("Account created successfully. Please sign in.", "success")
            return redirect(url_for("auth.login"))
        except Exception:
            current_app.logger.exception("Registration failed")
            flash("Registration failed. Please try again.", "error")

    return render_template("auth/register.html", form={})


@auth_bp.route("/logout")
def logout():
    user = get_current_user()
    if user:
        _audit(user.user_id, "logout", None, request.remote_addr)
    session.clear()
    resp = redirect(url_for("auth.login"))
    resp.delete_cookie("ilf_session")
    return resp


@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()

        with get_db() as conn:
            user = conn.execute(
                "SELECT user_id, name FROM users WHERE email = ? AND is_active = 1", (email,)
            ).fetchone()

        if user:
            raw_token, token_hash = create_reset_token()
            expires = Settings.now_utc()  # We'll handle expiry in DB

            import time
            exp_ts = int(time.time()) + 3600  # 1 hour

            with get_db() as conn:
                # Invalidate old tokens
                conn.execute(
                    "UPDATE reset_tokens SET used = 1 WHERE user_id = ?",
                    (user["user_id"],)
                )
                conn.execute(
                    """INSERT INTO reset_tokens (user_id, token_hash, expires_at, created_at)
                       VALUES (?, ?, datetime('now', '+1 hour'), ?)""",
                    (user["user_id"], token_hash, Settings.now_utc())
                )

            # Attempt to send email
            reset_url = url_for("auth.reset_password", token=raw_token, _external=True)
            try:
                _send_reset_email(email, user["name"], reset_url)
                _audit(user["user_id"], "password_reset_request", f"Reset requested for {email}", request.remote_addr)
            except Exception as exc:
                current_app.logger.warning("SMTP failed: %s", exc)

        # Always show same message (don't reveal if email exists)
        flash("If that email is registered, a reset link has been sent.", "success")
        return redirect(url_for("auth.login"))

    return render_template("auth/forgot_password.html")


@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    with get_db() as conn:
        record = conn.execute(
            """SELECT rt.token_id, rt.user_id, rt.used, rt.expires_at
               FROM reset_tokens rt
               WHERE rt.token_hash = ?""",
            (token_hash,)
        ).fetchone()

    if not record or record["used"]:
        flash("This reset link is invalid or has already been used.", "error")
        return redirect(url_for("auth.forgot_password"))

    # Check expiry
    import sqlite3
    with get_db() as conn:
        expired = conn.execute(
            "SELECT 1 FROM reset_tokens WHERE token_id = ? AND expires_at < datetime('now')",
            (record["token_id"],)
        ).fetchone()

    if expired:
        flash("This reset link has expired. Please request a new one.", "error")
        return redirect(url_for("auth.forgot_password"))

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        if len(password) < 8:
            flash("Password must be at least 8 characters.", "error")
            return render_template("auth/reset_password.html", token=token)
        if password != confirm:
            flash("Passwords do not match.", "error")
            return render_template("auth/reset_password.html", token=token)

        with get_db() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE user_id = ?",
                (generate_password_hash(password), record["user_id"])
            )
            conn.execute(
                "UPDATE reset_tokens SET used = 1 WHERE token_id = ?",
                (record["token_id"],)
            )

        _audit(record["user_id"], "password_reset_complete", None, request.remote_addr)
        flash("Password updated successfully. Please sign in.", "success")
        return redirect(url_for("auth.login"))

    return render_template("auth/reset_password.html", token=token)


def _send_reset_email(to_email: str, name: str, reset_url: str):
    if not Settings.SMTP_USER or not Settings.SMTP_PASS:
        current_app.logger.info("SMTP not configured; reset URL: %s", reset_url)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Password Reset — Intelligent Log Forensics"
    msg["From"] = Settings.SMTP_FROM
    msg["To"] = to_email

    html = f"""
    <html><body style="font-family:Inter,sans-serif;background:#f8fafc;padding:40px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      <h2 style="color:#0f172a;margin-top:0">Password Reset</h2>
      <p style="color:#475569">Hi {name},</p>
      <p style="color:#475569">Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="{reset_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Reset Password
      </a>
      <p style="color:#94a3b8;font-size:12px">If you did not request this, you can safely ignore this email.</p>
    </div>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(Settings.SMTP_HOST, Settings.SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(Settings.SMTP_USER, Settings.SMTP_PASS)
        smtp.sendmail(Settings.SMTP_FROM, to_email, msg.as_string())
