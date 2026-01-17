INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, user_agent, ip)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at, user_agent, ip;
