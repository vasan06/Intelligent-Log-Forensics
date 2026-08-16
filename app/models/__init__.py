from datetime import datetime, timezone
from types import SimpleNamespace

from werkzeug.security import check_password_hash


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Entity(SimpleNamespace):
    def __init__(self, row=None, **values):
        super().__init__(**dict(row or {}), **values)


class User(Entity):
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_active(self):
        return self.is_active_account


UploadedFile = NormalizedLog = DataQualityResult = RiskEvent = MitreMapping = Entity
Incident = IncidentEvent = Report = Entity
