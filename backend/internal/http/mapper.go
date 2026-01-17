package http

import (
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/trail/trail/backend/internal/domain"
	"github.com/trail/trail/backend/internal/openapi"
)

func mapUser(user domain.User) openapi.User {
	return openapi.User{
		Id:          user.ID,
		Email:       openapi_types.Email(user.Email),
		DisplayName: user.DisplayName,
		CreatedAt:   user.CreatedAt,
	}
}

func mapPlan(plan domain.Plan) openapi.Plan {
	out := openapi.Plan{
		Id:           plan.ID,
		Name:         plan.Name,
		Tier:         openapi.PlanTier(plan.Tier),
		PriceMonthly: centsToFloat32(plan.PriceMonthlyCents),
		PriceYearly:  centsToFloat32(plan.PriceYearlyCents),
		Currency:     plan.Currency,
		Features:     plan.Features,
		Highlight:    &plan.Highlight,
	}
	if plan.Rank != 0 {
		out.Rank = float32Ptr(float32(plan.Rank))
	}
	if plan.Limits != nil {
		out.Limits = &openapi.PlanLimits{
			MaxTrees:       intPointer(plan.Limits.MaxTrees),
			MaxDevices:     intPointer(plan.Limits.MaxDevices),
			MaxHistoryDays: intPointer(plan.Limits.MaxHistoryDays),
			MaxSavedViews:  intPointer(plan.Limits.MaxSavedViews),
		}
	}
	return out
}

func mapSubscription(sub domain.Subscription) openapi.Subscription {
	out := openapi.Subscription{
		Id:                 sub.ID,
		PlanId:             sub.PlanID,
		Status:             openapi.SubscriptionStatus(sub.Status),
		Interval:           openapi.SubscriptionInterval(sub.Interval),
		CurrentPeriodStart: sub.CurrentPeriodStart,
		CurrentPeriodEnd:   sub.CurrentPeriodEnd,
		CancelAtPeriodEnd:  sub.CancelAtPeriodEnd,
	}
	if sub.TrialEndsAt != nil {
		out.TrialEndsAt = sub.TrialEndsAt
	}
	if sub.CanceledAt != nil {
		out.CanceledAt = sub.CanceledAt
	}
	return out
}

func mapBillingStatus(status domain.BillingStatus) openapi.BillingStatus {
	out := openapi.BillingStatus{
		State: openapi.BillingStatusState(status.State),
	}
	if status.LastChargeAt != nil {
		out.LastChargeAt = status.LastChargeAt
	}
	if status.NextChargeAt != nil {
		out.NextChargeAt = status.NextChargeAt
	}
	if status.GraceEndsAt != nil {
		out.GraceEndsAt = status.GraceEndsAt
	}
	if status.PaymentMethod != nil {
		out.PaymentMethod = &openapi.PaymentMethod{
			Brand:    status.PaymentMethod.Brand,
			Last4:    status.PaymentMethod.Last4,
			ExpMonth: status.PaymentMethod.ExpMonth,
			ExpYear:  status.PaymentMethod.ExpYear,
		}
	}
	if status.FailureReason != nil {
		out.FailureReason = status.FailureReason
	}
	return out
}

func centsToFloat32(cents int64) float32 {
	return float32(cents) / 100.0
}

func intPointer(value *int) *float32 {
	if value == nil {
		return nil
	}
	v := float32(*value)
	return &v
}

func float32Ptr(value float32) *float32 {
	return &value
}
