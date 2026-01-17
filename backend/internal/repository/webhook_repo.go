package repository

import (
	"context"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type WebhookEventRepository struct {
	pool DB
}

func NewWebhookEventRepository(pool DB) *WebhookEventRepository {
	return &WebhookEventRepository{pool: pool}
}

func (r *WebhookEventRepository) Create(ctx context.Context, event domain.WebhookEvent) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("webhook_events_insert.sql"), event.ID, event.Provider, event.EventID, event.EventType, event.Payload, event.ReceivedAt, event.Status)
	return err
}
