package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/trail/trail/backend/internal/domain"
)

type memoryEmailRepo struct {
	codes map[string]domain.EmailCode
}

func newMemoryEmailRepo() *memoryEmailRepo {
	return &memoryEmailRepo{codes: map[string]domain.EmailCode{}}
}

func (m *memoryEmailRepo) Create(ctx context.Context, code domain.EmailCode) (domain.EmailCode, error) {
	m.codes[code.ID] = code
	return code, nil
}

func (m *memoryEmailRepo) GetActive(ctx context.Context, email string, purpose domain.EmailCodePurpose) (domain.EmailCode, error) {
	for _, code := range m.codes {
		if code.Email == email && code.Purpose == purpose && code.ConsumedAt == nil {
			return code, nil
		}
	}
	return domain.EmailCode{}, domain.ErrNotFound
}

func (m *memoryEmailRepo) GetLatest(ctx context.Context, email string, purpose domain.EmailCodePurpose) (domain.EmailCode, error) {
	var latest domain.EmailCode
	found := false
	for _, code := range m.codes {
		if code.Email == email && code.Purpose == purpose {
			if !found || code.CreatedAt.After(latest.CreatedAt) {
				latest = code
				found = true
			}
		}
	}
	if !found {
		return domain.EmailCode{}, domain.ErrNotFound
	}
	return latest, nil
}

func (m *memoryEmailRepo) Consume(ctx context.Context, id string, consumedAt time.Time) error {
	code := m.codes[id]
	code.ConsumedAt = &consumedAt
	m.codes[id] = code
	return nil
}

func (m *memoryEmailRepo) Invalidate(ctx context.Context, email string, purpose domain.EmailCodePurpose, consumedAt time.Time) error {
	for id, code := range m.codes {
		if code.Email == email && code.Purpose == purpose && code.ConsumedAt == nil {
			code.ConsumedAt = &consumedAt
			m.codes[id] = code
		}
	}
	return nil
}

func (m *memoryEmailRepo) IncrementAttempts(ctx context.Context, id string) error {
	code := m.codes[id]
	code.Attempts++
	m.codes[id] = code
	return nil
}

type captureSender struct {
	lastTo      string
	lastSubject string
	lastBody    string
}

func (c *captureSender) Send(ctx context.Context, to string, subject string, body string) error {
	c.lastTo = to
	c.lastSubject = subject
	c.lastBody = body
	return nil
}

func TestEmailCodeFlowRegister(t *testing.T) {
	users := newMemoryUserRepo()
	refresh := newMemoryRefreshRepo()
	plans := newMemoryPlanRepo()
	subs := newMemorySubRepo()
	codes := newMemoryEmailRepo()
	sender := &captureSender{}
	jwtManager := NewJWTManager("secret", 15*time.Minute)

	uc := NewAuthUsecase(users, refresh, noopPortalRepo{}, plans, subs, codes, sender, jwtManager, time.Hour, 10*time.Minute, 6)

	expiresAt, err := uc.StartEmailCode(context.Background(), "user@example.com", domain.EmailCodeRegister, nil, nil, nil)
	require.NoError(t, err)
	require.True(t, expiresAt.After(time.Now()))
	require.Contains(t, sender.lastBody, "verification code")

	// Grab code hash from repo and confirm using matching code via reflection of hash function
	var stored domain.EmailCode
	for _, code := range codes.codes {
		stored = code
		break
	}
	code := "000000"
	stored.CodeHash = hashCode(code)
	codes.codes[stored.ID] = stored

	result, err := uc.ConfirmEmailCode(context.Background(), "user@example.com", code, domain.EmailCodeRegister, nil)
	require.NoError(t, err)
	require.NotEmpty(t, result.AccessToken)
}
