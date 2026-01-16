SELECT id, status, user_id, expires_at, created_at
FROM auth_portal_sessions
WHERE id = $1;
