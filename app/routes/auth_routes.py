from flask import Blueprint, redirect, request, url_for
from flask_jwt_extended import (create_access_token, create_refresh_token, jwt_required,
                                set_access_cookies, set_refresh_cookies, unset_jwt_cookies)

from flask import jsonify

from app.models import utcnow
from app.repositories import user_repository
from app.extensions import limiter


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def _wants_json():
    return request.headers.get("Accept", "") == "application/json"


def _failure_route():
    return "auth.login" if request.path.endswith("/login") else "auth.register"


def _issue_jwt(response, user):
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response


def _spa_auth_path(route):
    """Map /auth/<route> to the SPA route, preserving the ?next= target."""
    next_url = request.args.get("next")
    if next_url and next_url.startswith("/") and not next_url.startswith("//"):
        return f"/{route}?next={next_url}"
    return f"/{route}"


def _respond(ok, *, message, success_to):
    if _wants_json():
        if ok:
            return jsonify({"ok": True, "redirect": success_to})
        return jsonify({"error": message}), 400
    if ok:
        return redirect(success_to)
    return redirect(url_for(_failure_route(), error=message))


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if len(name) < 2 or "@" not in email:
            return _respond(False, message="Enter a valid name and email address.", success_to=url_for("dashboard.index"))
        if len(password) < 10 or not any(c.isdigit() for c in password) or not any(c.isupper() for c in password):
            return _respond(False, message="Password needs 10+ characters, an uppercase letter, and a number.", success_to=url_for("dashboard.index"))
        if user_repository.find_by_email(email):
            return _respond(False, message="An account already exists for that email.", success_to=url_for("dashboard.index"))
        user = user_repository.create(name, email, password)
        return _issue_jwt(_respond(True, message="", success_to=url_for("dashboard.index")), user)
    return redirect(_spa_auth_path("register"))


@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit("30 per minute")
def login():
    if request.method == "POST":
        user = user_repository.find_by_email(request.form.get("email", ""))
        if user and user.check_password(request.form.get("password", "")):
            user_repository.update_last_login(user.id, utcnow())
            return _issue_jwt(
                _respond(True, message="", success_to=request.args.get("next") or url_for("dashboard.index")),
                user,
            )
        return _respond(False, message="Invalid email or password.", success_to=url_for("dashboard.index"))
    return redirect(_spa_auth_path("login"))


@auth_bp.get("/logout")
@jwt_required(optional=True)
def logout():
    response = redirect("/login")
    unset_jwt_cookies(response)
    return response
