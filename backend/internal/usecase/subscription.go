package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/billing"
	"github.com/trail/trail/backend/internal/domain"
)

type SubscriptionUsecase struct {
	subs     domain.SubscriptionRepository
	plans    domain.PlanRepository
	users    domain.UserRepository
	checkout domain.CheckoutSessionRepository
	provider billing.Provider
}

func NewSubscriptionUsecase(subs domain.SubscriptionRepository, plans domain.PlanRepository, users domain.UserRepository, checkout domain.CheckoutSessionRepository, provider billing.Provider) *SubscriptionUsecase {
	return &SubscriptionUsecase{subs: subs, plans: plans, users: users, checkout: checkout, provider: provider}
}

func (u *SubscriptionUsecase) GetByUser(ctx context.Context, userID string) (domain.Subscription, error) {
	return u.subs.GetByUserID(ctx, userID)
}

func (u *SubscriptionUsecase) Checkout(ctx context.Context, userID string, planID string, interval string, idempotencyKey *string, successURL string, cancelURL string) (domain.CheckoutSession, error) {
	if idempotencyKey != nil && *idempotencyKey != "" {
		if existing, err := u.checkout.GetByIdempotencyKey(ctx, *idempotencyKey); err == nil {
			return existing, nil
		} else if err != nil && err != domain.ErrNotFound {
			return domain.CheckoutSession{}, err
		}
	}
	user, err := u.users.GetByID(ctx, userID)
	if err != nil {
		return domain.CheckoutSession{}, err
	}
	plan, err := u.plans.GetByID(ctx, planID)
	if err != nil {
		return domain.CheckoutSession{}, err
	}
	result, err := u.provider.CreateCheckoutSession(ctx, user, plan, interval, successURL, cancelURL, idempotencyKey)
	if err != nil {
		return domain.CheckoutSession{}, err
	}
	check := domain.CheckoutSession{
		ID:                uuid.NewString(),
		UserID:            userID,
		PlanID:            planID,
		Interval:          interval,
		Provider:          result.Provider,
		ProviderSessionID: result.ProviderSessionID,
		URL:               result.URL,
		IdempotencyKey:    idempotencyKey,
		CreatedAt:         time.Now().UTC(),
	}
	return u.checkout.Create(ctx, check)
}

func (u *SubscriptionUsecase) Cancel(ctx context.Context, userID string) (domain.Subscription, error) {
	sub, err := u.subs.GetByUserID(ctx, userID)
	if err != nil {
		return domain.Subscription{}, err
	}
	if sub.ProviderSubscriptionID != "" {
		_ = u.provider.CancelSubscription(ctx, sub.ProviderSubscriptionID)
	}
	return u.subs.Cancel(ctx, userID, time.Now().UTC())
}
