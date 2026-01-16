INSERT INTO checkout_sessions (id, user_id, plan_id, interval, provider, provider_session_id, url, idempotency_key, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, user_id, plan_id, interval, provider, provider_session_id, url, idempotency_key, created_at;
