package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/domain"
)

type StripeStub struct {
	PortalBaseURL string
}

func NewStripeStub(portalBaseURL string) *StripeStub {
	return &StripeStub{PortalBaseURL: portalBaseURL}
}

func (s *StripeStub) Name() string {
	return "stripe_stub"
}

func (s *StripeStub) CreateCheckoutSession(ctx context.Context, user domain.User, plan domain.Plan, interval string, successURL string, cancelURL string) (CheckoutSession, error) {
	_ = ctx
	id := uuid.NewString()
	return CheckoutSession{
		URL:               fmt.Sprintf("%s/checkout/%s", s.PortalBaseURL, id),
		Provider:          s.Name(),
		ProviderSessionID: id,
	}, nil
}

func (s *StripeStub) CreateBillingPortalLink(ctx context.Context, user domain.User) (PortalLink, error) {
	_ = ctx
	id := uuid.NewString()
	return PortalLink{URL: fmt.Sprintf("%s/billing/%s", s.PortalBaseURL, id)}, nil
}

func (s *StripeStub) CancelSubscription(ctx context.Context, externalID string) error {
	_ = ctx
	_ = externalID
	return nil
}

func (s *StripeStub) ParseWebhook(ctx context.Context, payload []byte, headers map[string]string) (WebhookEvent, error) {
	_ = ctx
	_ = headers
	var generic map[string]any
	if err := json.Unmarshal(payload, &generic); err != nil {
		return WebhookEvent{}, err
	}
	id, _ := generic["id"].(string)
	eventType, _ := generic["type"].(string)
	if id == "" {
		id = uuid.NewString()
	}
	if eventType == "" {
		eventType = "invoice.paid"
	}
	generic["received_at"] = time.Now().UTC().Format(time.RFC3339)
	updated, _ := json.Marshal(generic)
	return WebhookEvent{EventID: id, EventType: eventType, Payload: updated}, nil
}
