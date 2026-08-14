UPDATE risk_events SET risk_category='Authentication Risk - Brute Force / Credential Stuffing'
WHERE risk_category='Authentication Risk â€” Brute Force / Credential Stuffing';
UPDATE risk_events SET attack_type=CASE risk_category
  WHEN 'Authentication Risk - Brute Force / Credential Stuffing' THEN 'credential-attacks'
  WHEN 'Reconnaissance / Route Scanning' THEN 'route-scanning'
  WHEN 'SQL Injection Attempt' THEN 'sql-injection'
  WHEN 'Cross-Site Scripting Attempt' THEN 'cross-site-scripting'
  WHEN 'Path Traversal Attempt' THEN 'path-traversal'
  WHEN 'Command Injection Attempt' THEN 'command-injection'
  WHEN 'Denial of Service Signal' THEN 'denial-of-service'
  WHEN 'Operational Risk' THEN 'operational-failure'
  WHEN 'Performance Risk' THEN 'performance-degradation'
  WHEN 'Frontend Runtime Risk' THEN 'frontend-runtime'
  ELSE 'security-warning' END
WHERE attack_type IS NULL;
ALTER TABLE risk_events ALTER COLUMN attack_type SET NOT NULL;
ALTER TABLE risk_events ADD CONSTRAINT risk_events_source_status_check CHECK (source_status IN ('uploaded','auto_generated'));
