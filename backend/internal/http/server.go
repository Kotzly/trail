package http

import (
	"context"
	"time"

	oapimiddleware "github.com/deepmap/oapi-codegen/pkg/middleware"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"

	"github.com/trail/trail/backend/internal/config"
	httpmw "github.com/trail/trail/backend/internal/http/middleware"
	"github.com/trail/trail/backend/internal/observability"
	"github.com/trail/trail/backend/internal/openapi"
	"github.com/trail/trail/backend/internal/usecase"
)

func NewServer(cfg config.Config, handler *Handler, tokens usecase.TokenManager, metrics *observability.Metrics, logger zerolog.Logger) (*echo.Echo, error) {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = ErrorHandler(logger)

	e.Use(echoMiddleware.RequestID())
	e.Use(echoMiddleware.Recover())
	e.Use(httpmw.SecurityHeaders())
	e.Use(httpmw.RequestLogger(logger))
	e.Use(httpmw.Metrics(metrics))
	e.Use(echoMiddleware.TimeoutWithConfig(echoMiddleware.TimeoutConfig{Timeout: cfg.RequestTimeout}))
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOrigins:     cfg.CORSAllowedOrigins,
		AllowHeaders:     []string{"Authorization", "Content-Type", "Idempotency-Key", "X-Idempotency-Key"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowCredentials: true,
	}))

	swagger, err := openapi.GetSwagger()
	if err != nil {
		return nil, err
	}
	swagger.Servers = openapi3.Servers{{URL: "/v1"}}

	e.Use(oapimiddleware.OapiRequestValidatorWithOptions(swagger, &oapimiddleware.Options{
		Options: openapi3filter.Options{AuthenticationFunc: httpmw.AuthenticationFunc(tokens)},
		Skipper: func(c echo.Context) bool {
			path := c.Request().URL.Path
			return path == "/metrics" || path == "/healthz" || path == "/readyz"
		},
		SilenceServersWarning: true,
	}))

	openapi.RegisterHandlersWithBaseURL(e, handler, "/v1")
	e.GET("/healthz", handler.GetHealthz)
	e.GET("/readyz", handler.GetReadyz)

	e.GET("/metrics", echo.WrapHandler(promhttp.Handler()))

	return e, nil
}

func Shutdown(e *echo.Echo, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return e.Shutdown(ctx)
}
