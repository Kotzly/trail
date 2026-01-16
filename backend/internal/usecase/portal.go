package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/domain"
)

type PortalUsecase struct {
	sessions domain.PortalSessionRepository
}

func NewPortalUsecase(sessions domain.PortalSessionRepository) *PortalUsecase {
	return &PortalUsecase{sessions: sessions}
}

func (u *PortalUsecase) Create(ctx context.Context, ttl time.Duration) (domain.PortalSession, error) {
	session := domain.PortalSession{
		ID:        uuid.NewString(),
		Status:    domain.PortalPending,
		ExpiresAt: time.Now().Add(ttl).UTC(),
		CreatedAt: time.Now().UTC(),
	}
	return u.sessions.Create(ctx, session)
}

func (u *PortalUsecase) Get(ctx context.Context, id string) (domain.PortalSession, error) {
	return u.sessions.GetByID(ctx, id)
}

func (u *PortalUsecase) Expire(ctx context.Context, id string) error {
	return u.sessions.MarkExpired(ctx, id)
}
