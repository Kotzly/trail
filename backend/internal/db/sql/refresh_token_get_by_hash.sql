SELECT id, user_id, token_hash, expires_at, revoked_at, created_at, user_agent, ip
FROM refresh_tokens
WHERE token_hash = $1;
