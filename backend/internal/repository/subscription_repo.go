package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type SubscriptionRepository struct {
	pool DB
}

func NewSubscriptionRepository(pool DB) *SubscriptionRepository {
	return &SubscriptionRepository{pool: pool}
}

func (r *SubscriptionRepository) GetByUserID(ctx context.Context, userID string) (domain.Subscription, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("subscriptions_get_by_user.sql"), userID)
	return scanSubscription(row)
}

func (r *SubscriptionRepository) Upsert(ctx context.Context, sub domain.Subscription) (domain.Subscription, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("subscriptions_upsert.sql"), sub.ID, sub.UserID, sub.PlanID, sub.Status, sub.Interval, sub.CurrentPeriodStart, sub.CurrentPeriodEnd, sub.CancelAtPeriodEnd, sub.TrialEndsAt, sub.CanceledAt, sub.Provider, sub.ProviderSubscriptionID)
	return scanSubscription(row)
}

func (r *SubscriptionRepository) Cancel(ctx context.Context, userID string, canceledAt time.Time) (domain.Subscription, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("subscriptions_cancel.sql"), userID, canceledAt)
	return scanSubscription(row)
}

func scanSubscription(row pgx.Row) (domain.Subscription, error) {
	var sub domain.Subscription
	var status string
	var trialEndsAt *time.Time
	var canceledAt *time.Time
	err := row.Scan(
		&sub.ID,
		&sub.UserID,
		&sub.PlanID,
		&status,
		&sub.Interval,
		&sub.CurrentPeriodStart,
		&sub.CurrentPeriodEnd,
		&sub.CancelAtPeriodEnd,
		&trialEndsAt,
		&canceledAt,
		&sub.Provider,
		&sub.ProviderSubscriptionID,
		&sub.CreatedAt,
		&sub.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Subscription{}, domain.ErrNotFound
		}
		return domain.Subscription{}, err
	}
	sub.Status = domain.SubscriptionStatus(status)
	sub.TrialEndsAt = trialEndsAt
	sub.CanceledAt = canceledAt
	return sub, nil
}
