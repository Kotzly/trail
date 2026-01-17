INSERT INTO webhook_events (id, provider, event_id, type, payload, received_at, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (provider, event_id) DO NOTHING;
