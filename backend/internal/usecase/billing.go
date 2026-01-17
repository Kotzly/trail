package usecase

import (
	"context"
	"errors"

	"github.com/trail/trail/backend/internal/billing"
	"github.com/trail/trail/backend/internal/domain"
)

type BillingUsecase struct {
	subs     domain.SubscriptionRepository
	users    domain.UserRepository
	provider billing.Provider
}

func NewBillingUsecase(subs domain.SubscriptionRepository, users domain.UserRepository, provider billing.Provider) *BillingUsecase {
	return &BillingUsecase{subs: subs, users: users, provider: provider}
}

func (u *BillingUsecase) GetStatus(ctx context.Context, userID string) (*domain.BillingStatus, error) {
	sub, err := u.subs.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	status := &domain.BillingStatus{State: mapBillingState(sub.Status)}
	return status, nil
}

func (u *BillingUsecase) CreatePortalLink(ctx context.Context, userID string) (billing.PortalLink, error) {
	user, err := u.users.GetByID(ctx, userID)
	if err != nil {
		return billing.PortalLink{}, err
	}
	return u.provider.CreateBillingPortalLink(ctx, user)
}

func mapBillingState(status domain.SubscriptionStatus) domain.BillingState {
	switch status {
	case domain.SubscriptionTrialing:
		return domain.BillingTrialing
	case domain.SubscriptionActive:
		return domain.BillingOK
	case domain.SubscriptionPastDue:
		return domain.BillingPastDue
	case domain.SubscriptionCanceled, domain.SubscriptionExpired:
		return domain.BillingCanceled
	case domain.SubscriptionPaused:
		return domain.BillingGrace
	default:
		return domain.BillingNone
	}
}
