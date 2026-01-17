UPDATE auth_portal_sessions
SET status = 'expired'
WHERE id = $1;
