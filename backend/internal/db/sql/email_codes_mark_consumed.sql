UPDATE email_codes
SET consumed_at = $2
WHERE id = $1;
