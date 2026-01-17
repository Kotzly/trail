SELECT id, email, purpose, code_hash, expires_at, created_at, consumed_at, attempts, user_agent, ip
FROM email_codes
WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
ORDER BY created_at DESC
LIMIT 1;
