package http

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"

	"github.com/trail/trail/backend/internal/domain"
	"github.com/trail/trail/backend/internal/openapi"
)

type APIError struct {
	Status  int
	Code    string
	Message string
	Details string
}

func (e *APIError) Error() string {
	return e.Message
}

func NewAPIError(status int, code string, message string, details string) *APIError {
	return &APIError{Status: status, Code: code, Message: message, Details: details}
}

func ErrorHandler(logger zerolog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		resp := openapi.ErrorResponse{Code: openapi.ErrorResponseCode("unknown"), Message: "unexpected error"}
		status := http.StatusInternalServerError

		switch e := err.(type) {
		case *APIError:
			status = e.Status
			resp.Code = mapErrorCode(e.Code)
			resp.Message = e.Message
			if e.Details != "" {
				resp.Details = &e.Details
			}
		case *echo.HTTPError:
			status = e.Code
			resp.Code = openapi.ErrorResponseCode("unknown")
			if msg, ok := e.Message.(string); ok {
				resp.Message = msg
			}
		default:
			if mapped, ok := mapDomainError(err); ok {
				status = mapped.Status
				resp.Code = mapErrorCode(mapped.Code)
				resp.Message = mapped.Message
				if mapped.Details != "" {
					resp.Details = &mapped.Details
				}
			}
		}
		logger.Error().Err(err).Int("status", status).Msg("request error")
		_ = c.JSON(status, resp)
	}
}

func mapErrorCode(code string) openapi.ErrorResponseCode {
	switch code {
	case "auth", "payment", "validation", "network":
		return openapi.ErrorResponseCode(code)
	default:
		return openapi.ErrorResponseCode("unknown")
	}
}

func mapDomainError(err error) (*APIError, bool) {
	switch {
	case errors.Is(err, domain.ErrInvalidCredentials), errors.Is(err, domain.ErrUnauthorized):
		return &APIError{Status: http.StatusUnauthorized, Code: "auth", Message: "unauthorized"}, true
	case errors.Is(err, domain.ErrForbidden):
		return &APIError{Status: http.StatusForbidden, Code: "auth", Message: "forbidden"}, true
	case errors.Is(err, domain.ErrNotFound):
		return &APIError{Status: http.StatusNotFound, Code: "validation", Message: "not found"}, true
	case errors.Is(err, domain.ErrConflict):
		return &APIError{Status: http.StatusConflict, Code: "validation", Message: "conflict"}, true
	case errors.Is(err, domain.ErrValidation):
		return &APIError{Status: http.StatusBadRequest, Code: "validation", Message: "invalid request"}, true
	default:
		return nil, false
	}
}
