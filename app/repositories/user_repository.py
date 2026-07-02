from app.models import User


def find_by_email(email):
    return User.query.filter_by(email=email.lower().strip()).first()

