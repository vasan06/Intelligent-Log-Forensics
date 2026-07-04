from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_user, logout_user

from app.extensions import db
from app.models import utcnow
from app.models import User
from app.repositories.user_repository import find_by_email


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if len(name) < 2 or "@" not in email:
            flash("Enter a valid name and email address.", "danger")
        elif len(password) < 10 or not any(c.isdigit() for c in password) or not any(c.isupper() for c in password):
            flash("Password needs 10+ characters, an uppercase letter, and a number.", "danger")
        elif find_by_email(email):
            flash("An account already exists for that email.", "danger")
        else:
            user = User(name=name, email=email, role="analyst")
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            login_user(user)
            return redirect(url_for("dashboard.index"))
    return render_template("auth/register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))
    if request.method == "POST":
        user = find_by_email(request.form.get("email", ""))
        if user and user.check_password(request.form.get("password", "")):
            user.last_login = utcnow()
            db.session.commit()
            login_user(user, remember=bool(request.form.get("remember")))
            return redirect(request.args.get("next") or url_for("dashboard.index"))
        flash("Invalid email or password.", "danger")
    return render_template("auth/login.html")


@auth_bp.get("/logout")
def logout():
    logout_user()
    return redirect(url_for("auth.login"))
