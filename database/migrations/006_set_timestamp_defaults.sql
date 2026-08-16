-- Heal databases whose tables predate schema defaults: several NOT NULL
-- timestamp columns had no default, which made repository inserts fail at
-- runtime. The application code is correct; this aligns an old database with
-- database/schema.sql. Idempotent (ALTER COLUMN ... SET DEFAULT).
ALTER TABLE uploaded_files  ALTER COLUMN upload_time    SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE normalized_logs ALTER COLUMN created_at     SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE risk_events     ALTER COLUMN created_at     SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE reports         ALTER COLUMN generated_at   SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users           ALTER COLUMN created_at     SET DEFAULT CURRENT_TIMESTAMP;
