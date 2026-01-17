package usecase

import (
	"context"

	"github.com/trail/trail/backend/internal/domain"
)

type AccountSnapshot struct {
	SessionStatus string
	User          *domain.User
	Subscription  *domain.Subscription
	Billing       *domain.BillingStatus
	Plans         []domain.Plan
}

type AccountUsecase struct {
	users   domain.UserRepository
	subs    domain.SubscriptionRepository
	plans   domain.PlanRepository
	billing *BillingUsecase
}

func NewAccountUsecase(users domain.UserRepository, subs domain.SubscriptionRepository, plans domain.PlanRepository, billing *BillingUsecase) *AccountUsecase {
	return &AccountUsecase{users: users, subs: subs, plans: plans, billing: billing}
}

func (u *AccountUsecase) Snapshot(ctx context.Context, userID *string) (AccountSnapshot, error) {
	plans, err := u.plans.ListActive(ctx)
	if err != nil {
		return AccountSnapshot{}, err
	}
	snapshot := AccountSnapshot{
		SessionStatus: "guest",
		Plans:         plans,
	}
	if userID == nil || *userID == "" {
		return snapshot, nil
	}
	user, err := u.users.GetByID(ctx, *userID)
	if err != nil {
		return AccountSnapshot{}, err
	}
	snapshot.User = &user
	snapshot.SessionStatus = "authenticated"
	if sub, err := u.subs.GetByUserID(ctx, user.ID); err == nil {
		snapshot.Subscription = &sub
	}
	if billing, err := u.billing.GetStatus(ctx, user.ID); err == nil {
		snapshot.Billing = billing
	}
	return snapshot, nil
}
