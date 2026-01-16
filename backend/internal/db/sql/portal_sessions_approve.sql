UPDATE auth_portal_sessions
SET status = 'approved', user_id = $2
WHERE id = $1;
