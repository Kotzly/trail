package billing

import (
	"context"

	"github.com/trail/trail/backend/internal/domain"
)

type CheckoutSession struct {
	URL               string
	Provider          string
	ProviderSessionID string
}

type PortalLink struct {
	URL string
}

type WebhookEvent struct {
	EventID   string
	EventType string
	Payload   []byte
}

// the Provider interface for billing that all examples must implement.
type Provider interface {
	Name() string
	CreateCheckoutSession(ctx context.Context, user domain.User, plan domain.Plan, interval string, successURL string, cancelURL string) (CheckoutSession, error)
	CreateBillingPortalLink(ctx context.Context, user domain.User) (PortalLink, error)
	CancelSubscription(ctx context.Context, externalID string) error
	ParseWebhook(ctx context.Context, payload []byte, headers map[string]string) (WebhookEvent, error)
}
