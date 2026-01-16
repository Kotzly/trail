package config

import (
	"time"

	"github.com/ilyakaznacheev/cleanenv"
	"github.com/joho/godotenv"
)

// todo: make this structured and via yaml and github.com/ilyakaznacheev/cleanenv
type Config struct {
	Env                 string        `env:"ENV" env-default:"development"`
	LogLevel            string        `env:"LOG_LEVEL" env-default:"info"`
	HTTPHost            string        `env:"HTTP_HOST" env-default:"0.0.0.0"`
	HTTPPort            string        `env:"HTTP_PORT" env-default:"8080"`
	RequestTimeout      time.Duration `env:"REQUEST_TIMEOUT" env-default:"15s"`
	ShutdownTimeout     time.Duration `env:"SHUTDOWN_TIMEOUT" env-default:"10s"`
	DatabaseURL         string        `env:"DATABASE_URL" env-required:"true"`
	DBMaxConns          int32         `env:"DB_MAX_CONNS" env-default:"10"`
	DBMinConns          int32         `env:"DB_MIN_CONNS" env-default:"2"`
	DBMaxConnLifetime   time.Duration `env:"DB_MAX_CONN_LIFETIME" env-default:"30m"`
	DBMaxConnIdleTime   time.Duration `env:"DB_MAX_CONN_IDLE_TIME" env-default:"5m"`
	JWTSecret           string        `env:"JWT_SECRET" env-required:"true"`
	AccessTokenTTL      time.Duration `env:"ACCESS_TOKEN_TTL" env-default:"15m"`
	RefreshTokenTTL     time.Duration `env:"REFRESH_TOKEN_TTL" env-default:"720h"`
	CookieDomain        string        `env:"COOKIE_DOMAIN" env-default:""`
	CookieSecure        bool          `env:"COOKIE_SECURE" env-default:"false"`
	CORSAllowedOrigins  []string      `env:"CORS_ALLOWED_ORIGINS" env-separator:"," env-default:"http://localhost:5173"`
	PortalBaseURL       string        `env:"PORTAL_BASE_URL" env-default:"http://localhost:5173"`
	BillingProvider     string        `env:"BILLING_PROVIDER" env-default:"stripe_stub"`
	StripeSecretKey     string        `env:"STRIPE_SECRET_KEY" env-default:""`
	StripeWebhookSecret string        `env:"STRIPE_WEBHOOK_SECRET" env-default:""`
}

func Load() (Config, error) {
	_ = godotenv.Load()
	var cfg Config
	if err := cleanenv.ReadEnv(&cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}
