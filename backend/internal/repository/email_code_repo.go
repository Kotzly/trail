package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type EmailCodeRepository struct {
	pool DB
}

func NewEmailCodeRepository(pool DB) *EmailCodeRepository {
	return &EmailCodeRepository{pool: pool}
}

func (r *EmailCodeRepository) Create(ctx context.Context, code domain.EmailCode) (domain.EmailCode, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("email_codes_create.sql"), code.ID, code.Email, code.Purpose, code.CodeHash, code.ExpiresAt, code.CreatedAt, code.UserAgent, code.IP)
	return scanEmailCode(row)
}

func (r *EmailCodeRepository) GetActive(ctx context.Context, email string, purpose domain.EmailCodePurpose) (domain.EmailCode, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("email_codes_get_active.sql"), email, purpose)
	return scanEmailCode(row)
}

func (r *EmailCodeRepository) GetLatest(ctx context.Context, email string, purpose domain.EmailCodePurpose) (domain.EmailCode, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("email_codes_get_latest.sql"), email, purpose)
	return scanEmailCode(row)
}

func (r *EmailCodeRepository) Consume(ctx context.Context, id string, consumedAt time.Time) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("email_codes_mark_consumed.sql"), id, consumedAt)
	return err
}

func (r *EmailCodeRepository) Invalidate(ctx context.Context, email string, purpose domain.EmailCodePurpose, consumedAt time.Time) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("email_codes_invalidate.sql"), email, purpose, consumedAt)
	return err
}

func (r *EmailCodeRepository) IncrementAttempts(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, sqlc.MustLoad("email_codes_increment_attempts.sql"), id)
	return err
}

func scanEmailCode(row pgx.Row) (domain.EmailCode, error) {
	var code domain.EmailCode
	var purpose string
	var consumedAt *time.Time
	err := row.Scan(&code.ID, &code.Email, &purpose, &code.CodeHash, &code.ExpiresAt, &code.CreatedAt, &consumedAt, &code.Attempts, &code.UserAgent, &code.IP)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.EmailCode{}, domain.ErrNotFound
		}
		return domain.EmailCode{}, err
	}
	code.Purpose = domain.EmailCodePurpose(purpose)
	code.ConsumedAt = consumedAt
	return code, nil
}
