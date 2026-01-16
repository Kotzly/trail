INSERT INTO auth_portal_sessions (id, status, user_id, expires_at, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, status, user_id, expires_at, created_at;
