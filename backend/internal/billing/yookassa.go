package billing

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/trail/trail/backend/internal/domain"
)

const defaultYooKassaBaseURL = "https://api.yookassa.ru/v3"

// YooKassaProvider implements billing.Provider with the YooKassa API.
type YooKassaProvider struct {
	ShopID        string
	SecretKey     string
	APIBaseURL    string
	PortalBaseURL string
	Client        *http.Client
}

func NewYooKassaProvider(shopID, secretKey, apiBaseURL, portalBaseURL string, client *http.Client) *YooKassaProvider {
	baseURL := strings.TrimRight(apiBaseURL, "/")
	if baseURL == "" {
		baseURL = defaultYooKassaBaseURL
	}
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &YooKassaProvider{
		ShopID:        shopID,
		SecretKey:     secretKey,
		APIBaseURL:    baseURL,
		PortalBaseURL: portalBaseURL,
		Client:        client,
	}
}

func (y *YooKassaProvider) Name() string {
	return "yookassa"
}

func (y *YooKassaProvider) CreateCheckoutSession(ctx context.Context, user domain.User, plan domain.Plan, interval string, successURL string, cancelURL string, idempotencyKey *string) (CheckoutSession, error) {
	amountCents, err := planPriceForInterval(plan, interval)
	if err != nil {
		return CheckoutSession{}, err
	}
	amountValue, err := formatAmountValue(amountCents)
	if err != nil {
		return CheckoutSession{}, err
	}
	currency := strings.TrimSpace(plan.Currency)
	if currency == "" {
		currency = "RUB"
	}
	returnURL := pickReturnURL(successURL, cancelURL, y.PortalBaseURL)
	requestID := idempotencyKey
	if requestID == nil || *requestID == "" {
		fallback := uuid.NewString()
		requestID = &fallback
	}

	reqBody := createPaymentRequest{
		Amount: amount{
			Value:    amountValue,
			Currency: currency,
		},
		PaymentMethodData: paymentMethodData{Type: "bank_card"},
		Confirmation: confirmation{
			Type:      "redirect",
			ReturnURL: returnURL,
		},
		Description: fmt.Sprintf("Trail %s (%s)", plan.Name, interval),
		Metadata: map[string]string{
			"user_id":  user.ID,
			"plan_id":  plan.ID,
			"interval": interval,
		},
		Capture: true,
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return CheckoutSession{}, &ProviderError{Code: "payment", Message: "failed to prepare yookassa payment", Details: err.Error()}
	}

	url := y.APIBaseURL + "/payments"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return CheckoutSession{}, &ProviderError{Code: "payment", Message: "failed to create yookassa request", Details: err.Error()}
	}
	req.SetBasicAuth(y.ShopID, y.SecretKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotence-Key", *requestID)

	resp, err := y.Client.Do(req)
	if err != nil {
		return CheckoutSession{}, &ProviderError{Code: "network", Message: "yookassa request failed", Details: err.Error()}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CheckoutSession{}, &ProviderError{Code: "network", Message: "failed to read yookassa response", Details: err.Error()}
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return CheckoutSession{}, y.mapAPIError(resp.StatusCode, body)
	}

	var result createPaymentResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return CheckoutSession{}, &ProviderError{Code: "payment", Message: "failed to parse yookassa response", Details: err.Error()}
	}
	confirmationURL := strings.TrimSpace(result.Confirmation.ConfirmationURL)
	if confirmationURL == "" {
		return CheckoutSession{}, &ProviderError{Code: "payment", Message: "yookassa confirmation url missing", Details: string(body)}
	}

	return CheckoutSession{
		URL:               confirmationURL,
		Provider:          y.Name(),
		ProviderSessionID: result.ID,
	}, nil
}

func (y *YooKassaProvider) CreateBillingPortalLink(ctx context.Context, user domain.User) (PortalLink, error) {
	_ = ctx
	_ = user
	return PortalLink{URL: strings.TrimRight(y.PortalBaseURL, "/") + "/dashboard"}, nil
}

func (y *YooKassaProvider) CancelSubscription(ctx context.Context, externalID string) error {
	_ = ctx
	_ = externalID
	return nil
}

func (y *YooKassaProvider) ParseWebhook(ctx context.Context, payload []byte, headers map[string]string) (WebhookEvent, error) {
	_ = ctx
	_ = headers

	var generic map[string]any
	if err := json.Unmarshal(payload, &generic); err != nil {
		return WebhookEvent{}, err
	}

	eventType := pickString(generic, "event")
	if eventType == "" {
		eventType = pickString(generic, "type")
	}

	eventID := pickString(generic, "id")
	if eventID == "" {
		eventID = pickNestedString(generic, "object", "id")
	}
	if eventID == "" {
		eventID = pickNestedString(generic, "data", "object", "id")
	}
	if eventID == "" {
		eventID = uuid.NewString()
	}
	if eventType == "" {
		eventType = "unknown"
	}

	generic["received_at"] = time.Now().UTC().Format(time.RFC3339)
	updated, err := json.Marshal(generic)
	if err != nil {
		return WebhookEvent{}, err
	}
	return WebhookEvent{EventID: eventID, EventType: eventType, Payload: updated}, nil
}

type amount struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

type paymentMethodData struct {
	Type string `json:"type"`
}

type confirmation struct {
	Type            string `json:"type"`
	ReturnURL       string `json:"return_url,omitempty"`
	ConfirmationURL string `json:"confirmation_url,omitempty"`
}

type createPaymentRequest struct {
	Amount            amount            `json:"amount"`
	PaymentMethodData paymentMethodData `json:"payment_method_data"`
	Confirmation      confirmation      `json:"confirmation"`
	Description       string            `json:"description,omitempty"`
	Metadata          map[string]string `json:"metadata,omitempty"`
	Capture           bool              `json:"capture,omitempty"`
	Receipt           map[string]any    `json:"receipt,omitempty"`
	ClientInfo        map[string]string `json:"client_info,omitempty"`
	PaymentMethodID   *string           `json:"payment_method_id,omitempty"`
	Recipient         map[string]any    `json:"recipient,omitempty"`
	SavePaymentMethod *bool             `json:"save_payment_method,omitempty"`
}

type createPaymentResponse struct {
	ID           string       `json:"id"`
	Status       string       `json:"status"`
	Confirmation confirmation `json:"confirmation"`
}

type yookassaErrorResponse struct {
	Type        string `json:"type"`
	ID          string `json:"id"`
	Code        string `json:"code"`
	Description string `json:"description"`
	Parameter   string `json:"parameter"`
}

func (y *YooKassaProvider) mapAPIError(status int, body []byte) error {
	resp := yookassaErrorResponse{}
	if err := json.Unmarshal(body, &resp); err != nil {
		return &ProviderError{Code: codeForStatus(status), Message: "yookassa request rejected", Details: string(body)}
	}
	message := "yookassa request rejected"
	if resp.Description != "" {
		message = resp.Description
	}
	details := strings.TrimSpace(fmt.Sprintf("type=%s code=%s id=%s param=%s", resp.Type, resp.Code, resp.ID, resp.Parameter))
	if details == "type= code= id= param=" {
		details = string(body)
	}
	return &ProviderError{Code: codeForStatus(status), Message: message, Details: details}
}

func codeForStatus(status int) string {
	switch {
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return "auth"
	case status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
		return "network"
	case status == http.StatusBadRequest || status == http.StatusUnprocessableEntity:
		return "validation"
	default:
		return "payment"
	}
}

func planPriceForInterval(plan domain.Plan, interval string) (int64, error) {
	switch strings.ToLower(interval) {
	case "month":
		return plan.PriceMonthlyCents, nil
	case "year":
		return plan.PriceYearlyCents, nil
	default:
		return 0, &ProviderError{Code: "validation", Message: "unsupported billing interval", Details: interval}
	}
}

func formatAmountValue(cents int64) (string, error) {
	if cents <= 0 {
		return "", &ProviderError{Code: "validation", Message: "invalid amount", Details: fmt.Sprintf("%d", cents)}
	}
	units := cents / 100
	fraction := cents % 100
	if fraction < 0 {
		fraction = -fraction
	}
	return fmt.Sprintf("%d.%02d", units, fraction), nil
}

func pickReturnURL(successURL, cancelURL, portalBaseURL string) string {
	if strings.TrimSpace(successURL) != "" {
		return successURL
	}
	if strings.TrimSpace(cancelURL) != "" {
		return cancelURL
	}
	base := strings.TrimRight(portalBaseURL, "/")
	if base == "" {
		return "https://example.com/"
	}
	return base + "/dashboard"
}

func pickString(data map[string]any, key string) string {
	value, ok := data[key]
	if !ok {
		return ""
	}
	text, _ := value.(string)
	return text
}

func pickNestedString(data map[string]any, keys ...string) string {
	current := any(data)
	for _, key := range keys {
		node, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current, ok = node[key]
		if !ok {
			return ""
		}
	}
	text, _ := current.(string)
	return text
}

func (y *YooKassaProvider) Validate() error {
	if strings.TrimSpace(y.ShopID) == "" || strings.TrimSpace(y.SecretKey) == "" {
		return errors.New("yookassa credentials missing")
	}
	return nil
}
