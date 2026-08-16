INSERT INTO users (name, email, password_hash, role)
VALUES ('Demo Analyst', 'analyst@example.com', 'seed-via-application-on-first-start', 'analyst')
ON CONFLICT (email) DO NOTHING;
