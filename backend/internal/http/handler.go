package http

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"

	"github.com/trail/trail/backend/internal/config"
	"github.com/trail/trail/backend/internal/domain"
	httpmw "github.com/trail/trail/backend/internal/http/middleware"
	"github.com/trail/trail/backend/internal/openapi"
	"github.com/trail/trail/backend/internal/usecase"
)

type Handler struct {
	cfg        config.Config
	logger     zerolog.Logger
	readyCheck func(ctx context.Context) error
	auth       *usecase.AuthUsecase
	account    *usecase.AccountUsecase
	plans      *usecase.PlanUsecase
	subs       *usecase.SubscriptionUsecase
	billing    *usecase.BillingUsecase
	portal     *usecase.PortalUsecase
	webhooks   *usecase.WebhookUsecase
	users      domain.UserRepository
	tokens     usecase.TokenManager
}

func NewHandler(cfg config.Config, logger zerolog.Logger, readyCheck func(ctx context.Context) error, auth *usecase.AuthUsecase, account *usecase.AccountUsecase, plans *usecase.PlanUsecase, subs *usecase.SubscriptionUsecase, billing *usecase.BillingUsecase, portal *usecase.PortalUsecase, webhooks *usecase.WebhookUsecase, users domain.UserRepository, tokens usecase.TokenManager) *Handler {
	return &Handler{
		cfg:        cfg,
		logger:     logger,
		readyCheck: readyCheck,
		auth:       auth,
		account:    account,
		plans:      plans,
		subs:       subs,
		billing:    billing,
		portal:     portal,
		webhooks:   webhooks,
		users:      users,
		tokens:     tokens,
	}
}

func (h *Handler) GetHealthz(ctx echo.Context) error {
	return ctx.JSON(http.StatusOK, openapi.HealthStatus{Status: "ok", Time: time.Now().UTC()})
}

func (h *Handler) GetReadyz(ctx echo.Context) error {
	if h.readyCheck != nil {
		if err := h.readyCheck(ctx.Request().Context()); err != nil {
			return ctx.JSON(http.StatusServiceUnavailable, openapi.ErrorResponse{Code: openapi.ErrorResponseCode("network"), Message: "dependencies unavailable"})
		}
	}
	return ctx.JSON(http.StatusOK, openapi.HealthStatus{Status: "ready", Time: time.Now().UTC()})
}

func (h *Handler) PostAuthRegister(ctx echo.Context) error {
	var input openapi.RegisterInput
	if err := ctx.Bind(&input); err != nil {
		return NewAPIError(http.StatusBadRequest, "validation", "invalid payload", "")
	}
	if input.Email == "" || input.Password == "" {
		return NewAPIError(http.StatusBadRequest, "validation", "email and password required", "")
	}
	result, err := h.auth.Register(ctx.Request().Context(), string(input.Email), input.Password, valueOrEmpty(input.DisplayName))
	if err != nil {
		return err
	}
	h.setRefreshCookie(ctx, result.RefreshToken)
	return ctx.JSON(http.StatusCreated, openapi.AuthResponse{
		User:        mapUser(result.User),
		AccessToken: result.AccessToken,
		ExpiresAt:   result.ExpiresAt,
	})
}

func (h *Handler) PostAuthLogin(ctx echo.Context) error {
	var input openapi.LoginInput
	if err := ctx.Bind(&input); err != nil {
		return NewAPIError(http.StatusBadRequest, "validation", "invalid payload", "")
	}
	result, err := h.auth.Login(ctx.Request().Context(), string(input.Email), input.Password, input.PortalSessionId)
	if err != nil {
		return err
	}
	h.setRefreshCookie(ctx, result.RefreshToken)
	return ctx.JSON(http.StatusOK, openapi.AuthResponse{
		User:        mapUser(result.User),
		AccessToken: result.AccessToken,
		ExpiresAt:   result.ExpiresAt,
	})
}

func (h *Handler) PostAuthRefresh(ctx echo.Context) error {
	cookie, err := ctx.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		return domain.ErrUnauthorized
	}
	result, err := h.auth.Refresh(ctx.Request().Context(), cookie.Value)
	if err != nil {
		return err
	}
	h.setRefreshCookie(ctx, result.RefreshToken)
	return ctx.JSON(http.StatusOK, openapi.RefreshResponse{
		AccessToken: result.AccessToken,
		ExpiresAt:   result.ExpiresAt,
		User:        toNullableUser(result.User),
	})
}

func (h *Handler) PostAuthLogout(ctx echo.Context) error {
	cookie, _ := ctx.Cookie("refresh_token")
	if cookie != nil {
		_ = h.auth.Logout(ctx.Request().Context(), cookie.Value)
	}
	h.clearRefreshCookie(ctx)
	return ctx.NoContent(http.StatusNoContent)
}

func (h *Handler) PostAuthPortal(ctx echo.Context) error {
	session, err := h.portal.Create(ctx.Request().Context(), 10*time.Minute)
	if err != nil {
		return err
	}
	url := strings.TrimRight(h.cfg.PortalBaseURL, "/") + "/login?portalSessionId=" + session.ID
	return ctx.JSON(http.StatusOK, openapi.AuthPortalSession{
		Id:             session.ID,
		Url:            url,
		ExpiresAt:      session.ExpiresAt,
		PollIntervalMs: intPtr(1500),
	})
}

func (h *Handler) GetAuthPortalSessionId(ctx echo.Context, sessionId string) error {
	session, err := h.portal.Get(ctx.Request().Context(), sessionId)
	if err != nil {
		return err
	}
	status := openapi.AuthPortalStatus{Status: openapi.AuthPortalStatusStatus(session.Status)}
	if session.Status == domain.PortalApproved && session.UserID != nil {
		snapshot, err := h.account.Snapshot(ctx.Request().Context(), session.UserID)
		if err == nil {
			mapped := h.mapAccountSnapshot(snapshot)
			status.Snapshot = &mapped
		}
	}
	if time.Now().After(session.ExpiresAt) && session.Status == domain.PortalPending {
		_ = h.portal.Expire(ctx.Request().Context(), session.ID)
		status.Status = openapi.AuthPortalStatusStatus(domain.PortalExpired)
	}
	return ctx.JSON(http.StatusOK, status)
}

func (h *Handler) GetAccount(ctx echo.Context) error {
	userID := h.optionalUserID(ctx)
	snapshot, err := h.account.Snapshot(ctx.Request().Context(), userID)
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, h.mapAccountSnapshot(snapshot))
}

func (h *Handler) GetMe(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	user, err := h.users.GetByID(ctx.Request().Context(), userID)
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, mapUser(user))
}

func (h *Handler) GetPlans(ctx echo.Context) error {
	plans, err := h.plans.ListPlans(ctx.Request().Context())
	if err != nil {
		return err
	}
	response := make([]openapi.Plan, 0, len(plans))
	for _, plan := range plans {
		response = append(response, mapPlan(plan))
	}
	return ctx.JSON(http.StatusOK, response)
}

func (h *Handler) GetSubscription(ctx echo.Context) error {
	return h.getSubscription(ctx)
}

func (h *Handler) GetSubscriptionsMe(ctx echo.Context) error {
	return h.getSubscription(ctx)
}

func (h *Handler) getSubscription(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	sub, err := h.subs.GetByUser(ctx.Request().Context(), userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return ctx.JSON(http.StatusOK, nil)
		}
		return err
	}
	return ctx.JSON(http.StatusOK, mapSubscription(sub))
}

func (h *Handler) PostSubscriptionCheckout(ctx echo.Context) error {
	return h.checkout(ctx)
}

func (h *Handler) PostBillingCheckout(ctx echo.Context) error {
	return h.checkout(ctx)
}

func (h *Handler) checkout(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	var input openapi.CheckoutInput
	if err := ctx.Bind(&input); err != nil {
		return NewAPIError(http.StatusBadRequest, "validation", "invalid payload", "")
	}
	idempotencyKey := ctx.Request().Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		idempotencyKey = ctx.Request().Header.Get("X-Idempotency-Key")
	}
	var keyPtr *string
	if idempotencyKey != "" {
		keyPtr = &idempotencyKey
	}
	session, err := h.subs.Checkout(ctx.Request().Context(), userID, input.PlanId, string(input.Interval), keyPtr, valueOrEmpty(input.SuccessUrl), valueOrEmpty(input.CancelUrl))
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, openapi.PortalLink{Url: session.URL})
}

func (h *Handler) PostSubscriptionsCancel(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	sub, err := h.subs.Cancel(ctx.Request().Context(), userID)
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, mapSubscription(sub))
}

func (h *Handler) GetBilling(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	status, err := h.billing.GetStatus(ctx.Request().Context(), userID)
	if err != nil {
		return err
	}
	if status == nil {
		return ctx.JSON(http.StatusOK, nil)
	}
	return ctx.JSON(http.StatusOK, mapBillingStatus(*status))
}

func (h *Handler) PostBillingPortal(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	link, err := h.billing.CreatePortalLink(ctx.Request().Context(), userID)
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, openapi.PortalLink{Url: link.URL})
}

func (h *Handler) PostWebhooksProvider(ctx echo.Context, provider string) error {
	var input openapi.WebhookEventInput
	if err := ctx.Bind(&input); err != nil {
		return NewAPIError(http.StatusBadRequest, "validation", "invalid payload", "")
	}
	payload, _ := json.Marshal(input)
	headers := map[string]string{}
	for key, values := range ctx.Request().Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}
	if err := h.webhooks.Handle(ctx.Request().Context(), provider, payload, headers); err != nil {
		return err
	}
	return ctx.NoContent(http.StatusOK)
}

func (h *Handler) PostAdminPlans(ctx echo.Context) error {
	userID, ok := h.requireUser(ctx)
	if !ok {
		return domain.ErrUnauthorized
	}
	role := h.requireRole(ctx)
	if role != string(domain.RoleAdmin) {
		return domain.ErrForbidden
	}
	_ = userID
	var input openapi.PlanUpsertInput
	if err := ctx.Bind(&input); err != nil {
		return NewAPIError(http.StatusBadRequest, "validation", "invalid payload", "")
	}
	rank := 0
	if input.Rank != nil {
		rank = int(*input.Rank)
	}
	plan := domain.Plan{
		ID:                valueOrEmpty(input.Id),
		Name:              input.Name,
		Tier:              domain.PlanTier(input.Tier),
		PriceMonthlyCents: floatToCents(input.PriceMonthly),
		PriceYearlyCents:  floatToCents(input.PriceYearly),
		Currency:          input.Currency,
		Features:          input.Features,
		Highlight:         valueOrBool(input.Highlight, false),
		Rank:              rank,
		Active:            valueOrBool(input.Active, true),
	}
	if input.Limits != nil {
		plan.Limits = &domain.PlanLimits{
			MaxTrees:       floatToInt(input.Limits.MaxTrees),
			MaxDevices:     floatToInt(input.Limits.MaxDevices),
			MaxHistoryDays: floatToInt(input.Limits.MaxHistoryDays),
			MaxSavedViews:  floatToInt(input.Limits.MaxSavedViews),
		}
	}
	updated, err := h.plans.Upsert(ctx.Request().Context(), plan)
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, mapPlan(updated))
}

func (h *Handler) mapAccountSnapshot(snapshot usecase.AccountSnapshot) openapi.AccountSnapshot {
	var user *openapi.User
	if snapshot.User != nil {
		mapped := mapUser(*snapshot.User)
		user = &mapped
	}
	var subscription *openapi.Subscription
	if snapshot.Subscription != nil {
		mapped := mapSubscription(*snapshot.Subscription)
		subscription = &mapped
	}
	var billing *openapi.BillingStatus
	if snapshot.Billing != nil {
		mapped := mapBillingStatus(*snapshot.Billing)
		billing = &mapped
	}
	plans := make([]openapi.Plan, 0, len(snapshot.Plans))
	for _, plan := range snapshot.Plans {
		plans = append(plans, mapPlan(plan))
	}
	return openapi.AccountSnapshot{
		Session:      openapi.AuthSession{Status: openapi.AuthSessionStatus(snapshot.SessionStatus)},
		User:         user,
		Subscription: subscription,
		Billing:      billing,
		Plans:        plans,
	}
}

func (h *Handler) requireUser(ctx echo.Context) (string, bool) {
	auth, ok := httpmw.GetAuth(ctx)
	if !ok || auth.UserID == "" {
		return "", false
	}
	return auth.UserID, true
}

func (h *Handler) requireRole(ctx echo.Context) string {
	auth, ok := httpmw.GetAuth(ctx)
	if !ok {
		return ""
	}
	return auth.Role
}

func (h *Handler) optionalUserID(ctx echo.Context) *string {
	value := ctx.Request().Header.Get("Authorization")
	if value == "" {
		return nil
	}
	parts := strings.SplitN(value, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return nil
	}
	claims, err := h.tokens.ParseAccessToken(parts[1])
	if err != nil {
		return nil
	}
	return &claims.UserID
}

func (h *Handler) setRefreshCookie(ctx echo.Context, token string) {
	cookie := new(http.Cookie)
	cookie.Name = "refresh_token"
	cookie.Value = token
	cookie.Path = "/"
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteLaxMode
	cookie.Secure = h.cfg.CookieSecure
	cookie.MaxAge = int(h.cfg.RefreshTokenTTL.Seconds())
	if h.cfg.CookieDomain != "" {
		cookie.Domain = h.cfg.CookieDomain
	}
	ctx.SetCookie(cookie)
}

func (h *Handler) clearRefreshCookie(ctx echo.Context) {
	cookie := new(http.Cookie)
	cookie.Name = "refresh_token"
	cookie.Value = ""
	cookie.Path = "/"
	cookie.MaxAge = -1
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteLaxMode
	cookie.Secure = h.cfg.CookieSecure
	if h.cfg.CookieDomain != "" {
		cookie.Domain = h.cfg.CookieDomain
	}
	ctx.SetCookie(cookie)
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func intPtr(v int) *int {
	return &v
}

func toNullableUser(user domain.User) *openapi.User {
	mapped := mapUser(user)
	return &mapped
}

func floatToCents(value float32) int64 {
	return int64(math.Round(float64(value) * 100))
}

func floatToInt(value *float32) *int {
	if value == nil {
		return nil
	}
	v := int(*value)
	return &v
}

func valueOrBool(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
