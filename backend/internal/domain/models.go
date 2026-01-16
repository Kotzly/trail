package domain

import "time"

type Role string

const (
	RoleUser  Role = "user"
	RoleAdmin Role = "admin"
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	Role         Role
	DisplayName  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type PlanTier string

const (
	PlanTierFree       PlanTier = "free"
	PlanTierPro        PlanTier = "pro"
	PlanTierTeam       PlanTier = "team"
	PlanTierEnterprise PlanTier = "enterprise"
)

type PlanLimits struct {
	MaxTrees       *int `json:"maxTrees"`
	MaxDevices     *int `json:"maxDevices"`
	MaxHistoryDays *int `json:"maxHistoryDays"`
	MaxSavedViews  *int `json:"maxSavedViews"`
}

type Plan struct {
	ID                string
	Name              string
	Tier              PlanTier
	PriceMonthlyCents int64
	PriceYearlyCents  int64
	Currency          string
	Features          []string
	Limits            *PlanLimits
	Highlight         bool
	Rank              int
	Active            bool
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type SubscriptionStatus string

const (
	SubscriptionTrialing SubscriptionStatus = "trialing"
	SubscriptionActive   SubscriptionStatus = "active"
	SubscriptionPastDue  SubscriptionStatus = "past_due"
	SubscriptionPaused   SubscriptionStatus = "paused"
	SubscriptionCanceled SubscriptionStatus = "canceled"
	SubscriptionExpired  SubscriptionStatus = "expired"
)

type Subscription struct {
	ID                     string
	UserID                 string
	PlanID                 string
	Status                 SubscriptionStatus
	Interval               string
	CurrentPeriodStart     time.Time
	CurrentPeriodEnd       time.Time
	CancelAtPeriodEnd      bool
	TrialEndsAt            *time.Time
	CanceledAt             *time.Time
	Provider               string
	ProviderSubscriptionID string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type BillingState string

const (
	BillingNone     BillingState = "none"
	BillingTrialing BillingState = "trialing"
	BillingOK       BillingState = "ok"
	BillingPastDue  BillingState = "past_due"
	BillingUnpaid   BillingState = "unpaid"
	BillingGrace    BillingState = "grace"
	BillingCanceled BillingState = "canceled"
)

type PaymentMethod struct {
	Brand    string
	Last4    string
	ExpMonth int
	ExpYear  int
}

type BillingStatus struct {
	State         BillingState
	LastChargeAt  *time.Time
	NextChargeAt  *time.Time
	GraceEndsAt   *time.Time
	PaymentMethod *PaymentMethod
	FailureReason *string
}

type InvoiceStatus string

const (
	InvoicePending InvoiceStatus = "pending"
	InvoicePaid    InvoiceStatus = "paid"
	InvoiceFailed  InvoiceStatus = "failed"
)

type Invoice struct {
	ID                string
	UserID            string
	SubscriptionID    *string
	AmountCents       int64
	Currency          string
	Status            InvoiceStatus
	Provider          string
	ProviderInvoiceID string
	CreatedAt         time.Time
}

type PaymentStatus string

const (
	PaymentPending PaymentStatus = "pending"
	PaymentPaid    PaymentStatus = "paid"
	PaymentFailed  PaymentStatus = "failed"
)

type Payment struct {
	ID                string
	InvoiceID         string
	AmountCents       int64
	Currency          string
	Status            PaymentStatus
	Provider          string
	ProviderPaymentID string
	CreatedAt         time.Time
}

type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
	UserAgent *string
	IP        *string
}

type PortalSessionStatus string

const (
	PortalPending  PortalSessionStatus = "pending"
	PortalApproved PortalSessionStatus = "approved"
	PortalExpired  PortalSessionStatus = "expired"
)

type PortalSession struct {
	ID        string
	Status    PortalSessionStatus
	UserID    *string
	ExpiresAt time.Time
	CreatedAt time.Time
}

type CheckoutSession struct {
	ID                string
	UserID            string
	PlanID            string
	Interval          string
	Provider          string
	ProviderSessionID string
	URL               string
	IdempotencyKey    *string
	CreatedAt         time.Time
}

type WebhookEvent struct {
	ID          string
	Provider    string
	EventID     string
	EventType   string
	Payload     []byte
	ReceivedAt  time.Time
	ProcessedAt *time.Time
	Status      string
}
