package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type CheckoutSessionRepository struct {
	pool DB
}

func NewCheckoutSessionRepository(pool DB) *CheckoutSessionRepository {
	return &CheckoutSessionRepository{pool: pool}
}

func (r *CheckoutSessionRepository) GetByIdempotencyKey(ctx context.Context, key string) (domain.CheckoutSession, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("checkout_sessions_get_by_key.sql"), key)
	return scanCheckoutSession(row)
}

func (r *CheckoutSessionRepository) Create(ctx context.Context, session domain.CheckoutSession) (domain.CheckoutSession, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("checkout_sessions_create.sql"), session.ID, session.UserID, session.PlanID, session.Interval, session.Provider, session.ProviderSessionID, session.URL, session.IdempotencyKey, session.CreatedAt)
	return scanCheckoutSession(row)
}

func scanCheckoutSession(row pgx.Row) (domain.CheckoutSession, error) {
	var session domain.CheckoutSession
	err := row.Scan(&session.ID, &session.UserID, &session.PlanID, &session.Interval, &session.Provider, &session.ProviderSessionID, &session.URL, &session.IdempotencyKey, &session.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CheckoutSession{}, domain.ErrNotFound
		}
		return domain.CheckoutSession{}, err
	}
	return session, nil
}
