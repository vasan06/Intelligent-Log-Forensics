-- Make the evidence-integrity timestamps resilient on databases whose
-- uploaded_files table predates the current schema defaults. The repository
-- already writes these columns explicitly; this heals existing deployments
-- and keeps direct inserts (validation tooling, ad-hoc SQL) safe.
ALTER TABLE uploaded_files ALTER COLUMN upload_time SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE uploaded_files ALTER COLUMN processing_status SET DEFAULT 'uploaded';
