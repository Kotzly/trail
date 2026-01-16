INSERT INTO email_codes (id, email, purpose, code_hash, expires_at, created_at, user_agent, ip)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, email, purpose, code_hash, expires_at, created_at, consumed_at, attempts, user_agent, ip;
