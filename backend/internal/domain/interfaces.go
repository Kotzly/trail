package domain

import (
	"context"
	"time"
)

type UserRepository interface {
	Create(ctx context.Context, user User) (User, error)
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id string) (User, error)
}

type RefreshTokenRepository interface {
	Create(ctx context.Context, token RefreshToken) (RefreshToken, error)
	GetByHash(ctx context.Context, hash string) (RefreshToken, error)
	Revoke(ctx context.Context, id string, revokedAt time.Time) error
	RevokeByHash(ctx context.Context, hash string, revokedAt time.Time) error
}

type PlanRepository interface {
	ListActive(ctx context.Context) ([]Plan, error)
	GetByID(ctx context.Context, id string) (Plan, error)
	Upsert(ctx context.Context, plan Plan) (Plan, error)
}

type SubscriptionRepository interface {
	GetByUserID(ctx context.Context, userID string) (Subscription, error)
	Upsert(ctx context.Context, sub Subscription) (Subscription, error)
	Cancel(ctx context.Context, userID string, canceledAt time.Time) (Subscription, error)
}

type CheckoutSessionRepository interface {
	GetByIdempotencyKey(ctx context.Context, key string) (CheckoutSession, error)
	Create(ctx context.Context, session CheckoutSession) (CheckoutSession, error)
}

type PortalSessionRepository interface {
	Create(ctx context.Context, session PortalSession) (PortalSession, error)
	GetByID(ctx context.Context, id string) (PortalSession, error)
	Approve(ctx context.Context, id string, userID string) error
	MarkExpired(ctx context.Context, id string) error
}

type WebhookEventRepository interface {
	Create(ctx context.Context, event WebhookEvent) error
}

type EmailCodeRepository interface {
	Create(ctx context.Context, code EmailCode) (EmailCode, error)
	GetActive(ctx context.Context, email string, purpose EmailCodePurpose) (EmailCode, error)
	GetLatest(ctx context.Context, email string, purpose EmailCodePurpose) (EmailCode, error)
	Consume(ctx context.Context, id string, consumedAt time.Time) error
	Invalidate(ctx context.Context, email string, purpose EmailCodePurpose, consumedAt time.Time) error
	IncrementAttempts(ctx context.Context, id string) error
}

type EmailSender interface {
	Send(ctx context.Context, to string, subject string, body string) error
}
