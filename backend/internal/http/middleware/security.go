package middleware

import "github.com/labstack/echo/v4"

func SecurityHeaders() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			res := c.Response().Header()
			res.Set("X-Content-Type-Options", "nosniff")
			res.Set("X-Frame-Options", "DENY")
			res.Set("Referrer-Policy", "no-referrer")
			res.Set("X-XSS-Protection", "1; mode=block")
			res.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';")
			return next(c)
		}
	}
}
