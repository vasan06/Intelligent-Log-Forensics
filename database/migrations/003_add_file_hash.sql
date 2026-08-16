ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS content_hash CHAR(64);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_content_hash ON uploaded_files(content_hash);
