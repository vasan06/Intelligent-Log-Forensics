CREATE INDEX IF NOT EXISTS idx_normalized_logs_file ON normalized_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_normalized_logs_timestamp ON normalized_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_risk_events_file ON risk_events(file_id);
CREATE INDEX IF NOT EXISTS idx_incidents_file ON incidents(file_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
