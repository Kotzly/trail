package repository

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v3"
	"github.com/stretchr/testify/require"
)

func TestUserRepositoryGetByEmail(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := NewUserRepository(mock)
	now := time.Now()

	rows := pgxmock.NewRows([]string{"id", "email", "password_hash", "role", "display_name", "created_at", "updated_at"}).
		AddRow("user-id", "user@example.com", "hash", "user", "User", now, now)

	query := regexp.QuoteMeta("SELECT id, email, password_hash, role, display_name, created_at, updated_at FROM users WHERE email = $1")
	mock.ExpectQuery(query).
		WithArgs("user@example.com").
		WillReturnRows(rows)

	user, err := repo.GetByEmail(context.Background(), "user@example.com")
	require.NoError(t, err)
	require.Equal(t, "user@example.com", user.Email)
	require.NoError(t, mock.ExpectationsWereMet())
}
