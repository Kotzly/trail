package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/trail/trail/backend/internal/domain"
)

type memoryUserRepo struct {
	byEmail map[string]domain.User
	byID    map[string]domain.User
}

func newMemoryUserRepo() *memoryUserRepo {
	return &memoryUserRepo{byEmail: map[string]domain.User{}, byID: map[string]domain.User{}}
}

func (m *memoryUserRepo) Create(ctx context.Context, user domain.User) (domain.User, error) {
	m.byEmail[user.Email] = user
	m.byID[user.ID] = user
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	return user, nil
}

func (m *memoryUserRepo) GetByEmail(ctx context.Context, email string) (domain.User, error) {
	user, ok := m.byEmail[email]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	return user, nil
}

func (m *memoryUserRepo) GetByID(ctx context.Context, id string) (domain.User, error) {
	user, ok := m.byID[id]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	return user, nil
}

type memoryRefreshRepo struct {
	byHash map[string]domain.RefreshToken
}

func newMemoryRefreshRepo() *memoryRefreshRepo {
	return &memoryRefreshRepo{byHash: map[string]domain.RefreshToken{}}
}

func (m *memoryRefreshRepo) Create(ctx context.Context, token domain.RefreshToken) (domain.RefreshToken, error) {
	m.byHash[token.TokenHash] = token
	return token, nil
}

func (m *memoryRefreshRepo) GetByHash(ctx context.Context, hash string) (domain.RefreshToken, error) {
	val, ok := m.byHash[hash]
	if !ok {
		return domain.RefreshToken{}, domain.ErrNotFound
	}
	return val, nil
}

func (m *memoryRefreshRepo) Revoke(ctx context.Context, id string, revokedAt time.Time) error {
	return nil
}

func (m *memoryRefreshRepo) RevokeByHash(ctx context.Context, hash string, revokedAt time.Time) error {
	return nil
}

type noopPortalRepo struct{}

func (n noopPortalRepo) Create(ctx context.Context, session domain.PortalSession) (domain.PortalSession, error) {
	return session, nil
}

func (n noopPortalRepo) GetByID(ctx context.Context, id string) (domain.PortalSession, error) {
	return domain.PortalSession{}, domain.ErrNotFound
}

func (n noopPortalRepo) Approve(ctx context.Context, id string, userID string) error {
	return nil
}

func (n noopPortalRepo) MarkExpired(ctx context.Context, id string) error {
	return nil
}

type memoryPlanRepo struct {
	plans []domain.Plan
}

func newMemoryPlanRepo() *memoryPlanRepo {
	return &memoryPlanRepo{plans: []domain.Plan{{ID: "plan-free", Tier: domain.PlanTierFree}}}
}

func (m *memoryPlanRepo) ListActive(ctx context.Context) ([]domain.Plan, error) {
	return m.plans, nil
}

func (m *memoryPlanRepo) GetByID(ctx context.Context, id string) (domain.Plan, error) {
	for _, plan := range m.plans {
		if plan.ID == id {
			return plan, nil
		}
	}
	return domain.Plan{}, domain.ErrNotFound
}

func (m *memoryPlanRepo) Upsert(ctx context.Context, plan domain.Plan) (domain.Plan, error) {
	m.plans = append(m.plans, plan)
	return plan, nil
}

type memorySubRepo struct{}

func newMemorySubRepo() *memorySubRepo {
	return &memorySubRepo{}
}

func (m *memorySubRepo) GetByUserID(ctx context.Context, userID string) (domain.Subscription, error) {
	return domain.Subscription{}, domain.ErrNotFound
}

func (m *memorySubRepo) Upsert(ctx context.Context, sub domain.Subscription) (domain.Subscription, error) {
	return sub, nil
}

func (m *memorySubRepo) Cancel(ctx context.Context, userID string, canceledAt time.Time) (domain.Subscription, error) {
	return domain.Subscription{}, domain.ErrNotFound
}

func TestAuthRegisterAndLogin(t *testing.T) {
	users := newMemoryUserRepo()
	refresh := newMemoryRefreshRepo()
	jwtManager := NewJWTManager("secret", 15*time.Minute)
	auth := NewAuthUsecase(users, refresh, noopPortalRepo{}, newMemoryPlanRepo(), newMemorySubRepo(), jwtManager, time.Hour)

	result, err := auth.Register(context.Background(), "user@example.com", "password123", "Test User")
	require.NoError(t, err)
	require.NotEmpty(t, result.AccessToken)
	require.NotEmpty(t, result.RefreshToken)
	require.Equal(t, "user@example.com", result.User.Email)

	loginResult, err := auth.Login(context.Background(), "user@example.com", "password123", nil)
	require.NoError(t, err)
	require.NotEmpty(t, loginResult.AccessToken)
}

func TestAuthLoginInvalidPassword(t *testing.T) {
	users := newMemoryUserRepo()
	refresh := newMemoryRefreshRepo()
	jwtManager := NewJWTManager("secret", 15*time.Minute)
	auth := NewAuthUsecase(users, refresh, noopPortalRepo{}, newMemoryPlanRepo(), newMemorySubRepo(), jwtManager, time.Hour)

	_, err := auth.Register(context.Background(), "user@example.com", "password123", "Test User")
	require.NoError(t, err)

	_, err = auth.Login(context.Background(), "user@example.com", "wrong", nil)
	require.ErrorIs(t, err, domain.ErrInvalidCredentials)
}
