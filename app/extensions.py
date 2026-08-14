from flask_login import LoginManager
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

login_manager = LoginManager()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address)
