package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/trail/trail/backend/internal/billing"
	"github.com/trail/trail/backend/internal/config"
	"github.com/trail/trail/backend/internal/db"
	httpserver "github.com/trail/trail/backend/internal/http"
	"github.com/trail/trail/backend/internal/observability"
	"github.com/trail/trail/backend/internal/repository"
	"github.com/trail/trail/backend/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}
	logger := observability.NewLogger(cfg.LogLevel)

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()

	metrics := observability.NewMetrics("trail", pool)

	provider := billing.NewStripeStub(cfg.PortalBaseURL)

	userRepo := repository.NewUserRepository(pool)
	refreshRepo := repository.NewRefreshTokenRepository(pool)
	planRepo := repository.NewPlanRepository(pool)
	subRepo := repository.NewSubscriptionRepository(pool)
	checkoutRepo := repository.NewCheckoutSessionRepository(pool)
	portalRepo := repository.NewPortalSessionRepository(pool)
	webhookRepo := repository.NewWebhookEventRepository(pool)

	tokens := usecase.NewJWTManager(cfg.JWTSecret, cfg.AccessTokenTTL)
	authUC := usecase.NewAuthUsecase(userRepo, refreshRepo, portalRepo, planRepo, subRepo, tokens, cfg.RefreshTokenTTL)
	billingUC := usecase.NewBillingUsecase(subRepo, userRepo, provider)
	accountUC := usecase.NewAccountUsecase(userRepo, subRepo, planRepo, billingUC)
	planUC := usecase.NewPlanUsecase(planRepo)
	subsUC := usecase.NewSubscriptionUsecase(subRepo, planRepo, userRepo, checkoutRepo, provider)
	portalUC := usecase.NewPortalUsecase(portalRepo)
	webhookUC := usecase.NewWebhookUsecase(webhookRepo, provider)

	handler := httpserver.NewHandler(cfg, logger, func(ctx context.Context) error {
		return db.Ping(ctx, pool)
	}, authUC, accountUC, planUC, subsUC, billingUC, portalUC, webhookUC, userRepo, tokens)

	e, err := httpserver.NewServer(cfg, handler, tokens, metrics, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create server")
	}

	server := &http.Server{
		Addr:              cfg.HTTPHost + ":" + cfg.HTTPPort,
		Handler:           e,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info().Str("addr", server.Addr).Msg("server listening")
		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("shutting down")
	ctxShutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(ctxShutdown); err != nil {
		logger.Error().Err(err).Msg("failed to shutdown server")
	}
}
