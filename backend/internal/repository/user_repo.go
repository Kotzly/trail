package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type UserRepository struct {
	pool DB
}

func NewUserRepository(pool DB) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) Create(ctx context.Context, user domain.User) (domain.User, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("users_create.sql"), user.ID, user.Email, user.PasswordHash, user.Role, user.DisplayName)
	return scanUser(row)
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (domain.User, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("users_get_by_email.sql"), email)
	return scanUser(row)
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (domain.User, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("users_get_by_id.sql"), id)
	return scanUser(row)
}

func scanUser(row pgx.Row) (domain.User, error) {
	var user domain.User
	var role string
	err := row.Scan(&user.ID, &user.Email, &user.PasswordHash, &role, &user.DisplayName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	user.Role = domain.Role(role)
	return user, nil
}
