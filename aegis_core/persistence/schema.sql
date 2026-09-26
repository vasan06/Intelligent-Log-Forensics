-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'analyst',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_login TEXT
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS reset_tokens (
    token_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

-- Uploaded log files
CREATE TABLE IF NOT EXISTS log_files (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_ext TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    record_count INTEGER NOT NULL DEFAULT 0,
    threat_count INTEGER NOT NULL DEFAULT 0,
    incident_count INTEGER NOT NULL DEFAULT 0,
    quality_score REAL NOT NULL DEFAULT 0.0,
    error_message TEXT,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

-- Parsed log records
CREATE TABLE IF NOT EXISTS log_records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    timestamp TEXT,
    source_ip TEXT,
    user_agent TEXT,
    resource TEXT,
    method TEXT,
    status_code INTEGER,
    event_type TEXT NOT NULL,
    message TEXT,
    raw_line TEXT NOT NULL,
    FOREIGN KEY(file_id) REFERENCES log_files(file_id)
);

-- Threat detections
CREATE TABLE IF NOT EXISTS threats (
    threat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    file_id INTEGER NOT NULL,
    severity TEXT NOT NULL,
    score INTEGER NOT NULL,
    ml_score INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    technique_id TEXT,
    finding TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    detected_at TEXT NOT NULL,
    FOREIGN KEY(record_id) REFERENCES log_records(record_id),
    FOREIGN KEY(file_id) REFERENCES log_files(file_id)
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    category TEXT NOT NULL,
    technique_id TEXT,
    root_cause TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(file_id) REFERENCES log_files(file_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    notif_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id INTEGER,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'full',
    status TEXT NOT NULL DEFAULT 'generated',
    file_path TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_records_file ON log_records(file_id);
CREATE INDEX IF NOT EXISTS idx_log_records_source ON log_records(source_ip);
CREATE INDEX IF NOT EXISTS idx_threats_file ON threats(file_id);
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_file ON incidents(file_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
