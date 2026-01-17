UPDATE refresh_tokens
SET revoked_at = $2
WHERE token_hash = $1;
