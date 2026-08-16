from werkzeug.security import generate_password_hash

from app.models import User
from app.repositories.database import execute, fetch_one


def find_by_email(email):
    row = fetch_one("SELECT * FROM users WHERE email=%s", (email.lower().strip(),))
    return User(row) if row else None


def get(user_id):
    row = fetch_one("SELECT * FROM users WHERE id=%s", (user_id,))
    return User(row) if row else None


def create(name, email, password, role="analyst"):
    row = execute(
        "INSERT INTO users (name,email,password_hash,role) VALUES (%s,%s,%s,%s) RETURNING *",
        (name, email.lower().strip(), generate_password_hash(password), role),
    )
    return User(row)


def update_last_login(user_id, timestamp):
    execute("UPDATE users SET last_login=%s WHERE id=%s", (timestamp, user_id))
