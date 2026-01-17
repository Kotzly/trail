UPDATE refresh_tokens
SET revoked_at = $2
WHERE id = $1;
