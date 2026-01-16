UPDATE email_codes
SET consumed_at = $3
WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL;
