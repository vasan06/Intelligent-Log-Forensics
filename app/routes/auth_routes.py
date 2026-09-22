from flask import Blueprint, redirect, render_template, request, url_for
from flask_jwt_extended import (create_access_token, create_refresh_token, jwt_required,
                                set_access_cookies, set_refresh_cookies, unset_jwt_cookies)

from flask import jsonify

from app.models import utcnow
from app.repositories import user_repository
from app.extensions import limiter

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

def _wants_json():
    return request.headers.get("Accept", "") == "application/json"

def _issue_jwt(response, user):
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if len(name) < 2 or "@" not in email:
            if _wants_json(): return jsonify({"error": "Enter a valid name and email address."}), 400
            return render_template("auth/register.html", error="Enter a valid name and email address.")
        if len(password) < 10 or not any(c.isdigit() for c in password) or not any(c.isupper() for c in password):
            if _wants_json(): return jsonify({"error": "Password needs 10+ characters, an uppercase letter, and a number."}), 400
            return render_template("auth/register.html", error="Password needs 10+ characters, an uppercase letter, and a number.")
        if user_repository.find_by_email(email):
            if _wants_json(): return jsonify({"error": "An account already exists for that email."}), 400
            return render_template("auth/register.html", error="An account already exists for that email.")
        user = user_repository.create(name, email, password)
        res = redirect(url_for("dashboard.index"))
        return _issue_jwt(res, user)
    return render_template("auth/register.html")

@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit("30 per minute")
def login():
    if request.method == "POST":
        user = user_repository.find_by_email(request.form.get("email", ""))
        if user and user.check_password(request.form.get("password", "")):
            user_repository.update_last_login(user.id, utcnow())
            res = redirect(request.args.get("next") or url_for("dashboard.index"))
            return _issue_jwt(res, user)
        if _wants_json(): return jsonify({"error": "Invalid email or password."}), 401
        return render_template("auth/login.html", error="Invalid email or password.")
    return render_template("auth/login.html")

@auth_bp.get("/logout")
@jwt_required(optional=True)
def logout():
    response = redirect("/login")
    unset_jwt_cookies(response)
    return response
