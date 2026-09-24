CREATE TABLE IF NOT EXISTS operators (
    operator_id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    work_email TEXT UNIQUE NOT NULL,
    credential_hash TEXT NOT NULL,
    clearance_tier TEXT NOT NULL DEFAULT 'Analyst',
    registered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_vault (
    vault_id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_ref INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    storage_descriptor TEXT NOT NULL,
    digest_sha256 TEXT NOT NULL,
    raw_payload BLOB,
    ingest_state TEXT NOT NULL,
    forensic_fidelity_rating REAL NOT NULL DEFAULT 0.0,
    ingested_count INTEGER NOT NULL DEFAULT 0,
    diagnostic_trace TEXT,
    received_timestamp TEXT NOT NULL,
    FOREIGN KEY(operator_ref) REFERENCES operators(operator_id)
);

CREATE TABLE IF NOT EXISTS telemetry_records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_ref INTEGER NOT NULL,
    observed_epoch TEXT,
    origin_address TEXT,
    actor_identifier TEXT,
    resource_target TEXT,
    action_verb TEXT,
    response_code INTEGER,
    signal_classification TEXT NOT NULL,
    log_excerpt TEXT,
    payload_blob TEXT NOT NULL,
    FOREIGN KEY(vault_ref) REFERENCES evidence_vault(vault_id)
);

CREATE TABLE IF NOT EXISTS threat_signals (
    signal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_ref INTEGER,
    vault_ref INTEGER NOT NULL,
    urgency_level TEXT NOT NULL,
    threat_magnitude INTEGER NOT NULL,
    ml_anomaly_score INTEGER NOT NULL DEFAULT 0,
    ml_model_breakdown TEXT,
    threat_domain TEXT NOT NULL,
    matrix_technique_ref TEXT,
    forensic_hypothesis TEXT NOT NULL,
    fidelity_percentage INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(record_ref) REFERENCES telemetry_records(record_id),
    FOREIGN KEY(vault_ref) REFERENCES evidence_vault(vault_id)
);

CREATE TABLE IF NOT EXISTS incident_clusters (
    cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_ref INTEGER NOT NULL,
    cluster_headline TEXT NOT NULL,
    triage_severity TEXT NOT NULL,
    attribution_confidence INTEGER NOT NULL,
    cluster_disposition TEXT NOT NULL DEFAULT 'Active',
    causal_assessment TEXT NOT NULL,
    associated_technique TEXT,
    opened_at TEXT NOT NULL,
    FOREIGN KEY(vault_ref) REFERENCES evidence_vault(vault_id)
);

CREATE TABLE IF NOT EXISTS broadcast_bulletins (
    bulletin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_operator_ref INTEGER NOT NULL,
    bulletin_body TEXT NOT NULL,
    urgency_marker TEXT NOT NULL DEFAULT 'info',
    acknowledged INTEGER NOT NULL DEFAULT 0,
    dispatched_at TEXT NOT NULL,
    FOREIGN KEY(recipient_operator_ref) REFERENCES operators(operator_id)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_vault ON telemetry_records(vault_ref);
CREATE INDEX IF NOT EXISTS idx_telemetry_origin ON telemetry_records(origin_address);
CREATE INDEX IF NOT EXISTS idx_threat_vault ON threat_signals(vault_ref);
CREATE INDEX IF NOT EXISTS idx_threat_magnitude ON threat_signals(threat_magnitude);
CREATE INDEX IF NOT EXISTS idx_clusters_vault ON incident_clusters(vault_ref);
CREATE INDEX IF NOT EXISTS idx_bulletins_recipient ON broadcast_bulletins(recipient_operator_ref, acknowledged);
