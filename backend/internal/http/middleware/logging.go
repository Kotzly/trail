package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

func RequestLogger(base zerolog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			rid := c.Response().Header().Get(echo.HeaderXRequestID)
			if rid == "" {
				rid = c.Request().Header.Get(echo.HeaderXRequestID)
			}
			logger := base.With().Str("request_id", rid).Logger()
			ctx := logger.WithContext(c.Request().Context())
			c.SetRequest(c.Request().WithContext(ctx))
			start := time.Now()
			err := next(c)
			status := c.Response().Status
			logger.Info().
				Str("method", c.Request().Method).
				Str("path", c.Path()).
				Int("status", status).
				Dur("duration", time.Since(start)).
				Msg("request completed")
			return err
		}
	}
}

func LoggerFromContext(c echo.Context, fallback zerolog.Logger) zerolog.Logger {
	logger := zerolog.Ctx(c.Request().Context())
	if logger == nil || logger.GetLevel() == zerolog.NoLevel {
		return fallback
	}
	return *logger
}
