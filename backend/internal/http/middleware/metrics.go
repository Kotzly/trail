package middleware

import (
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/trail/trail/backend/internal/observability"
)

func Metrics(m *observability.Metrics) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			status := c.Response().Status
			path := c.Path()
			if path == "" {
				path = c.Request().URL.Path
			}
			labels := []string{c.Request().Method, path, strconv.Itoa(status)}
			m.RequestTotal.WithLabelValues(labels...).Inc()
			m.RequestDuration.WithLabelValues(labels...).Observe(time.Since(start).Seconds())
			return err
		}
	}
}
