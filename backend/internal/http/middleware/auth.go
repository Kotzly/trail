package middleware

import (
	"context"
	"errors"
	"strings"

	oapimiddleware "github.com/deepmap/oapi-codegen/pkg/middleware"
	"github.com/getkin/kin-openapi/openapi3filter"

	"github.com/trail/trail/backend/internal/usecase"
)

type AuthContext struct {
	UserID string
	Role   string
}

const ContextUserKey = "auth_user"

func AuthenticationFunc(tokens usecase.TokenManager) func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		req := input.RequestValidationInput.Request
		auth := req.Header.Get("Authorization")
		if auth == "" {
			return errors.New("missing bearer token")
		}
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return errors.New("invalid bearer token")
		}
		claims, err := tokens.ParseAccessToken(parts[1])
		if err != nil {
			return err
		}
		eCtx := oapimiddleware.GetEchoContext(ctx)
		if eCtx != nil {
			eCtx.Set(ContextUserKey, AuthContext{UserID: claims.UserID, Role: claims.Role})
		}
		return nil
	}
}

func GetAuth(c interface{ Get(string) interface{} }) (AuthContext, bool) {
	value := c.Get(ContextUserKey)
	if value == nil {
		return AuthContext{}, false
	}
	ctx, ok := value.(AuthContext)
	return ctx, ok
}
