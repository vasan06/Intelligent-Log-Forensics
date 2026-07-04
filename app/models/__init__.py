from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="analyst")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    last_login = db.Column(db.DateTime)
    is_active_account = db.Column(db.Boolean, nullable=False, default=True)

    uploads = db.relationship("UploadedFile", backref="owner", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_active(self):
        return self.is_active_account


class UploadedFile(db.Model):
    __tablename__ = "uploaded_files"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    upload_time = db.Column(db.DateTime, nullable=False, default=utcnow)
    processing_status = db.Column(db.String(30), nullable=False, default="uploaded")
    total_records = db.Column(db.Integer, default=0)
    valid_records = db.Column(db.Integer, default=0)
    invalid_records = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text)

    logs = db.relationship("NormalizedLog", backref="uploaded_file", cascade="all, delete-orphan")
    quality = db.relationship(
        "DataQualityResult", backref="uploaded_file", uselist=False, cascade="all, delete-orphan"
    )
    risks = db.relationship("RiskEvent", backref="uploaded_file", cascade="all, delete-orphan")
    incidents = db.relationship("Incident", backref="uploaded_file", cascade="all, delete-orphan")
    reports = db.relationship("Report", backref="uploaded_file", cascade="all, delete-orphan")


class NormalizedLog(db.Model):
    __tablename__ = "normalized_logs"

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey("uploaded_files.id"), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, index=True)
    source_ip = db.Column(db.String(64))
    user_identifier = db.Column(db.String(255))
    method = db.Column(db.String(16))
    endpoint = db.Column(db.String(500))
    status_code = db.Column(db.Integer)
    response_time = db.Column(db.Float)
    log_source_type = db.Column(db.String(40), nullable=False, default="Application")
    event_type = db.Column(db.String(100))
    level = db.Column(db.String(30))
    message = db.Column(db.Text)
    raw_log = db.Column(db.Text, nullable=False)
    is_valid = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    risks = db.relationship("RiskEvent", backref="log", cascade="all, delete-orphan")


class DataQualityResult(db.Model):
    __tablename__ = "data_quality_results"

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey("uploaded_files.id"), nullable=False, unique=True)
    total_logs = db.Column(db.Integer, nullable=False)
    valid_logs = db.Column(db.Integer, nullable=False)
    invalid_logs = db.Column(db.Integer, nullable=False)
    duplicate_logs = db.Column(db.Integer, nullable=False)
    missing_timestamp_count = db.Column(db.Integer, nullable=False)
    missing_ip_count = db.Column(db.Integer, nullable=False)
    quality_score = db.Column(db.Float, nullable=False)
    health_score = db.Column(db.Float, nullable=False)


class RiskEvent(db.Model):
    __tablename__ = "risk_events"

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey("uploaded_files.id"), nullable=False, index=True)
    log_id = db.Column(db.Integer, db.ForeignKey("normalized_logs.id"), nullable=False)
    risk_category = db.Column(db.String(80), nullable=False)
    risk_score = db.Column(db.Float, nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    evidence = db.Column(db.Text)
    recommendation = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    mitre_mapping = db.relationship(
        "MitreMapping", backref="risk_event", uselist=False, cascade="all, delete-orphan"
    )


class MitreMapping(db.Model):
    __tablename__ = "mitre_mappings"

    id = db.Column(db.Integer, primary_key=True)
    risk_event_id = db.Column(db.Integer, db.ForeignKey("risk_events.id"), nullable=False, unique=True)
    tactic = db.Column(db.String(100), nullable=False)
    technique_id = db.Column(db.String(30), nullable=False)
    technique_name = db.Column(db.String(255), nullable=False)
    confidence_score = db.Column(db.Float, nullable=False)
    mapping_reason = db.Column(db.Text, nullable=False)


class Incident(db.Model):
    __tablename__ = "incidents"

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey("uploaded_files.id"), nullable=False, index=True)
    incident_title = db.Column(db.String(255), nullable=False)
    source_ip = db.Column(db.String(64))
    affected_user = db.Column(db.String(255))
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    overall_risk_score = db.Column(db.Float, nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    summary = db.Column(db.Text, nullable=False)

    events = db.relationship(
        "IncidentEvent", backref="incident", cascade="all, delete-orphan", order_by="IncidentEvent.event_time"
    )


class IncidentEvent(db.Model):
    __tablename__ = "incident_events"

    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(db.Integer, db.ForeignKey("incidents.id"), nullable=False)
    event_time = db.Column(db.DateTime)
    event_type = db.Column(db.String(100))
    description = db.Column(db.Text, nullable=False)
    risk_category = db.Column(db.String(80))
    mitre_tactic = db.Column(db.String(100))
    mitre_technique = db.Column(db.String(255))


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey("uploaded_files.id"), nullable=False)
    report_name = db.Column(db.String(255), nullable=False)
    report_path = db.Column(db.String(500), nullable=False)
    generated_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    generated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
