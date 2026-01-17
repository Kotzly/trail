package usecase

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TokenManager interface {
	GenerateAccessToken(userID string, role string) (string, time.Time, error)
	ParseAccessToken(token string) (*Claims, error)
}

type Claims struct {
	UserID string `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}
