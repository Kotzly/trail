package usecase

import (
	"context"
	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/domain"
)

type PlanUsecase struct {
	plans domain.PlanRepository
}

func NewPlanUsecase(plans domain.PlanRepository) *PlanUsecase {
	return &PlanUsecase{plans: plans}
}

func (u *PlanUsecase) ListPlans(ctx context.Context) ([]domain.Plan, error) {
	return u.plans.ListActive(ctx)
}

func (u *PlanUsecase) Upsert(ctx context.Context, plan domain.Plan) (domain.Plan, error) {
	if plan.ID == "" {
		plan.ID = uuid.NewString()
	}
	return u.plans.Upsert(ctx, plan)
}
