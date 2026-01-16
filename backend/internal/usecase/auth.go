package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
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
	emailCodes     domain.EmailCodeRepository
	emailSender    domain.EmailSender
	tokens         TokenManager
	refreshTTL     time.Duration
	emailCodeTTL   time.Duration
	emailCodeLen   int
}

func NewAuthUsecase(
	users domain.UserRepository,
	refreshTokens domain.RefreshTokenRepository,
	portalSessions domain.PortalSessionRepository,
	plans domain.PlanRepository,
	subs domain.SubscriptionRepository,
	emailCodes domain.EmailCodeRepository,
	emailSender domain.EmailSender,
	tokens TokenManager,
	refreshTTL time.Duration,
	emailCodeTTL time.Duration,
	emailCodeLen int,
) *AuthUsecase {
	return &AuthUsecase{
		users:          users,
		refreshTokens:  refreshTokens,
		portalSessions: portalSessions,
		plans:          plans,
		subs:           subs,
		emailCodes:     emailCodes,
		emailSender:    emailSender,
		tokens:         tokens,
		refreshTTL:     refreshTTL,
		emailCodeTTL:   emailCodeTTL,
		emailCodeLen:   emailCodeLen,
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

func (u *AuthUsecase) StartEmailCode(ctx context.Context, email string, purpose domain.EmailCodePurpose, displayName *string, userAgent *string, ip *string) (time.Time, error) {
	if purpose != domain.EmailCodeLogin && purpose != domain.EmailCodeRegister {
		return time.Time{}, domain.ErrValidation
	}

	switch purpose {
	case domain.EmailCodeLogin:
		if _, err := u.users.GetByEmail(ctx, email); err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return time.Time{}, domain.ErrNotFound
			}
			return time.Time{}, err
		}
	case domain.EmailCodeRegister:
		if _, err := u.users.GetByEmail(ctx, email); err == nil {
			return time.Time{}, domain.ErrConflict
		} else if !errors.Is(err, domain.ErrNotFound) {
			return time.Time{}, err
		}
		if displayName != nil && *displayName == "" {
			displayName = nil
		}
	}

	now := time.Now().UTC()
	if u.emailCodeTTL <= 0 {
		u.emailCodeTTL = 10 * time.Minute
	}
	codeLen := u.emailCodeLen
	if codeLen < 4 || codeLen > 12 {
		codeLen = 6
	}

	if err := u.emailCodes.Invalidate(ctx, email, purpose, now); err != nil {
		return time.Time{}, err
	}

	code, err := generateNumericCode(codeLen)
	if err != nil {
		return time.Time{}, err
	}
	codeHash := hashCode(code)
	expiresAt := now.Add(u.emailCodeTTL)

	record := domain.EmailCode{
		ID:        uuid.NewString(),
		Email:     email,
		Purpose:   purpose,
		CodeHash:  codeHash,
		ExpiresAt: expiresAt,
		CreatedAt: now,
		UserAgent: userAgent,
		IP:        ip,
	}

	created, err := u.emailCodes.Create(ctx, record)
	if err != nil {
		return time.Time{}, err
	}

	if u.emailSender != nil {
		subject := "Your Trail verification code"
		body := fmt.Sprintf("Your verification code is: %s\n\nIt expires in %d minutes.", code, int(u.emailCodeTTL.Minutes()))
		if err := u.emailSender.Send(ctx, email, subject, body); err != nil {
			_ = u.emailCodes.Consume(ctx, created.ID, time.Now().UTC())
			return time.Time{}, err
		}
	}

	return expiresAt, nil
}

func (u *AuthUsecase) ConfirmEmailCode(ctx context.Context, email string, code string, purpose domain.EmailCodePurpose, displayName *string) (AuthResult, error) {
	if code == "" || email == "" {
		return AuthResult{}, domain.ErrValidation
	}
	if purpose != domain.EmailCodeLogin && purpose != domain.EmailCodeRegister {
		return AuthResult{}, domain.ErrValidation
	}

	record, err := u.emailCodes.GetActive(ctx, email, purpose)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			latest, latestErr := u.emailCodes.GetLatest(ctx, email, purpose)
			if latestErr != nil {
				return AuthResult{}, err
			}
			if time.Now().UTC().After(latest.ExpiresAt) {
				return AuthResult{}, domain.ErrExpired
			}
			return AuthResult{}, domain.ErrValidation
		}
		return AuthResult{}, err
	}

	now := time.Now().UTC()
	if now.After(record.ExpiresAt) {
		_ = u.emailCodes.Consume(ctx, record.ID, now)
		return AuthResult{}, domain.ErrExpired
	}

	if subtle.ConstantTimeCompare([]byte(record.CodeHash), []byte(hashCode(code))) != 1 {
		_ = u.emailCodes.IncrementAttempts(ctx, record.ID)
		return AuthResult{}, domain.ErrValidation
	}

	if err := u.emailCodes.Consume(ctx, record.ID, now); err != nil {
		return AuthResult{}, err
	}

	var user domain.User
	switch purpose {
	case domain.EmailCodeLogin:
		user, err = u.users.GetByEmail(ctx, email)
		if err != nil {
			return AuthResult{}, err
		}
	case domain.EmailCodeRegister:
		if displayName == nil || *displayName == "" {
			value := email
			displayName = &value
		}
		randomPassword, err := generateToken(24)
		if err != nil {
			return AuthResult{}, err
		}
		passwordHash, err := domain.HashPassword(randomPassword)
		if err != nil {
			return AuthResult{}, err
		}
		user = domain.User{
			ID:           uuid.NewString(),
			Email:        email,
			PasswordHash: passwordHash,
			Role:         domain.RoleUser,
			DisplayName:  *displayName,
		}
		created, err := u.users.Create(ctx, user)
		if err != nil {
			return AuthResult{}, err
		}
		if err := u.ensureDefaultSubscription(ctx, created.ID); err != nil {
			return AuthResult{}, err
		}
		user = created
	}

	return u.issueTokens(ctx, user)
}

func generateNumericCode(length int) (string, error) {
	if length < 4 {
		length = 6
	}
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = byte('0' + (b[i] % 10))
	}
	return string(b), nil
}

func hashCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return base64.RawURLEncoding.EncodeToString(sum[:])
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
