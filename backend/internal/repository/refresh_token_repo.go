package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type RefreshTokenRepository struct {
	pool DB
}

func NewRefreshTokenRepository(pool DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{pool: pool}
}

func (r *RefreshTokenRepository) Create(ctx context.Context, token domain.RefreshToken) (domain.RefreshToken, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("refresh_token_create.sql"), token.ID, token.UserID, token.TokenHash, token.ExpiresAt, token.CreatedAt, token.UserAgent, token.IP)
	return scanRefreshToken(row)
}

func (r *RefreshTokenRepository) GetByHash(ctx context.Context, hash string) (domain.RefreshToken, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("refresh_token_get_by_hash.sql"), hash)
	return scanRefreshToken(row)
}

func (r *RefreshTokenRepository) Revoke(ctx context.Context, id string, revokedAt time.Time) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("refresh_token_revoke.sql"), id, revokedAt)
	return err
}

func (r *RefreshTokenRepository) RevokeByHash(ctx context.Context, hash string, revokedAt time.Time) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("refresh_token_revoke_by_hash.sql"), hash, revokedAt)
	return err
}

func scanRefreshToken(row pgx.Row) (domain.RefreshToken, error) {
	var token domain.RefreshToken
	var revokedAt *time.Time
	err := row.Scan(&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &revokedAt, &token.CreatedAt, &token.UserAgent, &token.IP)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.RefreshToken{}, domain.ErrNotFound
		}
		return domain.RefreshToken{}, err
	}
	if revokedAt != nil {
		token.RevokedAt = revokedAt
	}
	return token, nil
}
