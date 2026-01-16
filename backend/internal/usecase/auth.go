package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/domain"
)

type AuthUsecase struct {
	users          domain.UserRepository
	refreshTokens  domain.RefreshTokenRepository
	portalSessions domain.PortalSessionRepository
	plans          domain.PlanRepository
	subs           domain.SubscriptionRepository
	tokens         TokenManager
	refreshTTL     time.Duration
}

func NewAuthUsecase(users domain.UserRepository, refreshTokens domain.RefreshTokenRepository, portalSessions domain.PortalSessionRepository, plans domain.PlanRepository, subs domain.SubscriptionRepository, tokens TokenManager, refreshTTL time.Duration) *AuthUsecase {
	return &AuthUsecase{
		users:          users,
		refreshTokens:  refreshTokens,
		portalSessions: portalSessions,
		plans:          plans,
		subs:           subs,
		tokens:         tokens,
		refreshTTL:     refreshTTL,
	}
}

type AuthResult struct {
	User         domain.User
	AccessToken  string
	ExpiresAt    time.Time
	RefreshToken string
}

func (u *AuthUsecase) Register(ctx context.Context, email, password, displayName string) (AuthResult, error) {
	_, err := u.users.GetByEmail(ctx, email)
	if err == nil {
		return AuthResult{}, domain.ErrConflict
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, err
	}
	if displayName == "" {
		displayName = email
	}
	hash, err := domain.HashPassword(password)
	if err != nil {
		return AuthResult{}, err
	}
	user := domain.User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: hash,
		Role:         domain.RoleUser,
		DisplayName:  displayName,
	}
	created, err := u.users.Create(ctx, user)
	if err != nil {
		return AuthResult{}, err
	}
	if err := u.ensureDefaultSubscription(ctx, created.ID); err != nil {
		return AuthResult{}, err
	}
	return u.issueTokens(ctx, created)
}

func (u *AuthUsecase) Login(ctx context.Context, email, password string, portalSessionID *string) (AuthResult, error) {
	user, err := u.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return AuthResult{}, domain.ErrInvalidCredentials
		}
		return AuthResult{}, err
	}
	ok, err := domain.VerifyPassword(password, user.PasswordHash)
	if err != nil {
		return AuthResult{}, err
	}
	if !ok {
		return AuthResult{}, domain.ErrInvalidCredentials
	}
	if portalSessionID != nil && *portalSessionID != "" {
		_ = u.portalSessions.Approve(ctx, *portalSessionID, user.ID)
	}
	return u.issueTokens(ctx, user)
}

func (u *AuthUsecase) Refresh(ctx context.Context, refreshToken string) (AuthResult, error) {
	hash := hashToken(refreshToken)
	stored, err := u.refreshTokens.GetByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return AuthResult{}, domain.ErrUnauthorized
		}
		return AuthResult{}, err
	}
	if stored.RevokedAt != nil || time.Now().After(stored.ExpiresAt) {
		return AuthResult{}, domain.ErrUnauthorized
	}
	user, err := u.users.GetByID(ctx, stored.UserID)
	if err != nil {
		return AuthResult{}, err
	}
	_ = u.refreshTokens.RevokeByHash(ctx, hash, time.Now().UTC())
	return u.issueTokens(ctx, user)
}

func (u *AuthUsecase) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	hash := hashToken(refreshToken)
	return u.refreshTokens.RevokeByHash(ctx, hash, time.Now().UTC())
}

func (u *AuthUsecase) issueTokens(ctx context.Context, user domain.User) (AuthResult, error) {
	accessToken, expiresAt, err := u.tokens.GenerateAccessToken(user.ID, string(user.Role))
	if err != nil {
		return AuthResult{}, err
	}
	refreshToken, err := generateToken(32)
	if err != nil {
		return AuthResult{}, err
	}
	refreshHash := hashToken(refreshToken)
	_, err = u.refreshTokens.Create(ctx, domain.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: time.Now().Add(u.refreshTTL),
		CreatedAt: time.Now().UTC(),
	})
	if err != nil {
		return AuthResult{}, err
	}
	return AuthResult{User: user, AccessToken: accessToken, ExpiresAt: expiresAt, RefreshToken: refreshToken}, nil
}

func (u *AuthUsecase) ensureDefaultSubscription(ctx context.Context, userID string) error {
	plans, err := u.plans.ListActive(ctx)
	if err != nil {
		return err
	}
	if len(plans) == 0 {
		return domain.ErrNotFound
	}
	plan := plans[0]
	for _, candidate := range plans {
		if candidate.Tier == domain.PlanTierFree {
			plan = candidate
			break
		}
	}
	now := time.Now().UTC()
	_, err = u.subs.Upsert(ctx, domain.Subscription{
		ID:                 uuid.NewString(),
		UserID:             userID,
		PlanID:             plan.ID,
		Status:             domain.SubscriptionActive,
		Interval:           "month",
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.AddDate(0, 1, 0),
		CancelAtPeriodEnd:  false,
		Provider:           "stripe_stub",
	})
	return err
}

func generateToken(size int) (string, error) {
	b := make([]byte, size)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
