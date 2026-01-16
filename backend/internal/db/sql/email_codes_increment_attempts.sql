UPDATE email_codes
SET attempts = attempts + 1
WHERE id = $1;
