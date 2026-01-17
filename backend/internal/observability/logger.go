package observability

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func NewLogger(level string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	lvl, err := zerolog.ParseLevel(strings.ToLower(level))
	if err != nil {
		lvl = zerolog.InfoLevel
	}
	logger := zerolog.New(os.Stdout).Level(lvl).With().Timestamp().Logger()
	log.Logger = logger
	return logger
}
