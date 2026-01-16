package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	sqlc "github.com/trail/trail/backend/internal/db/sql"
	"github.com/trail/trail/backend/internal/domain"
)

type PlanRepository struct {
	pool DB
}

func NewPlanRepository(pool DB) *PlanRepository {
	return &PlanRepository{pool: pool}
}

func (r *PlanRepository) ListActive(ctx context.Context) ([]domain.Plan, error) {
	rows, err := r.pool.Query(ctx, sqlc.MustLoad("plans_list_active.sql"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var plans []domain.Plan
	for rows.Next() {
		plan, err := scanPlan(rows)
		if err != nil {
			return nil, err
		}
		plans = append(plans, plan)
	}
	return plans, rows.Err()
}

func (r *PlanRepository) GetByID(ctx context.Context, id string) (domain.Plan, error) {
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("plans_get_by_id.sql"), id)
	return scanPlan(row)
}

func (r *PlanRepository) Upsert(ctx context.Context, plan domain.Plan) (domain.Plan, error) {
	limits, err := json.Marshal(plan.Limits)
	if err != nil {
		return domain.Plan{}, err
	}
	row := r.pool.QueryRow(ctx, sqlc.MustLoad("plans_upsert.sql"), plan.ID, plan.Name, plan.Tier, plan.PriceMonthlyCents, plan.PriceYearlyCents, plan.Currency, plan.Features, limits, plan.Highlight, plan.Rank, plan.Active)
	return scanPlan(row)
}

func scanPlan(row pgx.Row) (domain.Plan, error) {
	var plan domain.Plan
	var tier string
	var features []string
	var limitsBytes []byte
	err := row.Scan(&plan.ID, &plan.Name, &tier, &plan.PriceMonthlyCents, &plan.PriceYearlyCents, &plan.Currency, &features, &limitsBytes, &plan.Highlight, &plan.Rank, &plan.Active, &plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Plan{}, domain.ErrNotFound
		}
		return domain.Plan{}, err
	}
	plan.Tier = domain.PlanTier(tier)
	plan.Features = features
	if len(limitsBytes) > 0 {
		var limits domain.PlanLimits
		if err := json.Unmarshal(limitsBytes, &limits); err != nil {
			return domain.Plan{}, err
		}
		plan.Limits = &limits
	}
	return plan, nil
}
