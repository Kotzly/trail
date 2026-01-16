package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type PortalSessionRepository struct {
	pool DB
}

func NewPortalSessionRepository(pool DB) *PortalSessionRepository {
	return &PortalSessionRepository{pool: pool}
}

func (r *PortalSessionRepository) Create(ctx context.Context, session domain.PortalSession) (domain.PortalSession, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("portal_sessions_create.sql"), session.ID, session.Status, session.UserID, session.ExpiresAt, session.CreatedAt)
	return scanPortalSession(row)
}

func (r *PortalSessionRepository) GetByID(ctx context.Context, id string) (domain.PortalSession, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("portal_sessions_get_by_id.sql"), id)
	return scanPortalSession(row)
}

func (r *PortalSessionRepository) Approve(ctx context.Context, id string, userID string) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("portal_sessions_approve.sql"), id, userID)
	return err
}

func (r *PortalSessionRepository) MarkExpired(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("portal_sessions_mark_expired.sql"), id)
	return err
}

func scanPortalSession(row pgx.Row) (domain.PortalSession, error) {
	var session domain.PortalSession
	var status string
	var userID *string
	err := row.Scan(&session.ID, &status, &userID, &session.ExpiresAt, &session.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.PortalSession{}, domain.ErrNotFound
		}
		return domain.PortalSession{}, err
	}
	session.Status = domain.PortalSessionStatus(status)
	session.UserID = userID
	return session, nil
}
