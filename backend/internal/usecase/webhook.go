package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/billing"
	"github.com/trail/trail/backend/internal/domain"
)

type WebhookUsecase struct {
	repo     domain.WebhookEventRepository
	provider billing.Provider
}

func NewWebhookUsecase(repo domain.WebhookEventRepository, provider billing.Provider) *WebhookUsecase {
	return &WebhookUsecase{repo: repo, provider: provider}
}

func (u *WebhookUsecase) Handle(ctx context.Context, provider string, payload []byte, headers map[string]string) error {
	parsed, err := u.provider.ParseWebhook(ctx, payload, headers)
	if err != nil {
		return err
	}
	event := domain.WebhookEvent{
		ID:         uuid.NewString(),
		Provider:   provider,
		EventID:    parsed.EventID,
		EventType:  parsed.EventType,
		Payload:    parsed.Payload,
		ReceivedAt: time.Now().UTC(),
		Status:     "received",
	}
	return u.repo.Create(ctx, event)
}
