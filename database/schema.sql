-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ,
    is_active_account BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. UPLOADED FILES TABLE
CREATE TABLE IF NOT EXISTS uploaded_files (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64), -- Added file hash for duplicate detection
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    total_records INTEGER NOT NULL DEFAULT 0,
    valid_records INTEGER NOT NULL DEFAULT 0,
    invalid_records INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

-- 3. NORMALIZED LOGS TABLE
CREATE TABLE IF NOT EXISTS normalized_logs (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ,
    source_ip VARCHAR(64), 
    user_identifier VARCHAR(255), 
    method VARCHAR(16),
    endpoint VARCHAR(500), 
    status_code INTEGER, 
    response_time DOUBLE PRECISION,
    log_source_type VARCHAR(40) NOT NULL DEFAULT 'Application', 
    event_type VARCHAR(100),
    level VARCHAR(30), 
    message TEXT, 
    raw_log TEXT NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. DATA QUALITY RESULTS TABLE
CREATE TABLE IF NOT EXISTS data_quality_results (
    id BIGSERIAL PRIMARY KEY, 
    file_id BIGINT NOT NULL UNIQUE REFERENCES uploaded_files(id) ON DELETE CASCADE,
    total_logs INTEGER NOT NULL, 
    valid_logs INTEGER NOT NULL, 
    invalid_logs INTEGER NOT NULL,
    duplicate_logs INTEGER NOT NULL, 
    missing_timestamp_count INTEGER NOT NULL,
    missing_ip_count INTEGER NOT NULL, 
    quality_score DOUBLE PRECISION NOT NULL, 
    health_score DOUBLE PRECISION NOT NULL
);

-- 5. RISK EVENTS TABLE
CREATE TABLE IF NOT EXISTS risk_events (
    id BIGSERIAL PRIMARY KEY, 
    file_id BIGINT NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    log_id BIGINT NOT NULL REFERENCES normalized_logs(id) ON DELETE CASCADE,
    risk_category VARCHAR(100) NOT NULL, 
    risk_score DOUBLE PRECISION NOT NULL,
    severity VARCHAR(20) NOT NULL, 
    reason TEXT NOT NULL, 
    evidence TEXT, 
    recommendation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. MITRE MAPPINGS TABLE
CREATE TABLE IF NOT EXISTS mitre_mappings (
    id BIGSERIAL PRIMARY KEY, 
    risk_event_id BIGINT NOT NULL UNIQUE REFERENCES risk_events(id) ON DELETE CASCADE,
    tactic VARCHAR(100) NOT NULL, 
    technique_id VARCHAR(30) NOT NULL,
    technique_name VARCHAR(255) NOT NULL, 
    confidence_score DOUBLE PRECISION NOT NULL, 
    mapping_reason TEXT NOT NULL
);

-- 7. INCIDENTS TABLE
CREATE TABLE IF NOT EXISTS incidents (
    id BIGSERIAL PRIMARY KEY, 
    file_id BIGINT NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    incident_title VARCHAR(255) NOT NULL, 
    source_ip VARCHAR(64), 
    affected_user VARCHAR(255),
    start_time TIMESTAMPTZ, 
    end_time TIMESTAMPTZ, 
    overall_risk_score DOUBLE PRECISION NOT NULL,
    severity VARCHAR(20) NOT NULL, 
    summary TEXT NOT NULL
);

-- 8. INCIDENT EVENTS TABLE
CREATE TABLE IF NOT EXISTS incident_events (
    id BIGSERIAL PRIMARY KEY, 
    incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_time TIMESTAMPTZ, 
    event_type VARCHAR(100), 
    description TEXT NOT NULL,
    risk_category VARCHAR(100), 
    mitre_tactic VARCHAR(100), 
    mitre_technique VARCHAR(255)
);

-- 9. REPORTS TABLE
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY, 
    file_id BIGINT NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL, 
    report_path VARCHAR(500) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    generated_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- PERFORMANCE INDEXES (Critical for Fast API Response in Postman)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_normalized_logs_file_id ON normalized_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_file_id ON risk_events(file_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_log_id ON risk_events(log_id);
CREATE INDEX IF NOT EXISTS idx_incidents_file_id ON incidents(file_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident_id ON incident_events(incident_id);