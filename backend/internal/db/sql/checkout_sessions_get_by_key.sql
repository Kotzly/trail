SELECT id, user_id, plan_id, interval, provider, provider_session_id, url, idempotency_key, created_at
FROM checkout_sessions
WHERE idempotency_key = $1;
