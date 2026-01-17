package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"

	"github.com/rs/zerolog"

	"github.com/trail/trail/backend/internal/config"
	"github.com/trail/trail/backend/internal/domain"
)

type LogSender struct {
	Logger zerolog.Logger
}

func (s LogSender) Send(ctx context.Context, to string, subject string, body string) error {
	_ = ctx
	s.Logger.Info().Str("to", to).Str("subject", subject).Msgf("email body:\n%s", body)
	return nil
}

type SMTPSender struct {
	Host     string
	Port     int
	User     string
	Pass     string
	From     string
	FromName string
	UseTLS   bool
}

func (s *SMTPSender) Send(ctx context.Context, to string, subject string, body string) error {
	_ = ctx
	if s.Host == "" || s.From == "" {
		return fmt.Errorf("smtp host/from not configured")
	}
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)
	from := formatFrom(s.FromName, s.From)
	msg := buildMessage(from, to, subject, body)

	var auth smtp.Auth
	if s.User != "" {
		auth = smtp.PlainAuth("", s.User, s.Pass, s.Host)
	}

	if s.UseTLS {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.Host})
		if err != nil {
			return err
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, s.Host)
		if err != nil {
			return err
		}
		defer client.Quit()

		if auth != nil {
			if ok, _ := client.Extension("AUTH"); ok {
				if err := client.Auth(auth); err != nil {
					return err
				}
			}
		}

		if err := client.Mail(s.From); err != nil {
			return err
		}
		if err := client.Rcpt(to); err != nil {
			return err
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		if _, err := w.Write([]byte(msg)); err != nil {
			_ = w.Close()
			return err
		}
		return w.Close()
	}

	if auth != nil {
		if host, _, err := net.SplitHostPort(addr); err == nil {
			auth = smtp.PlainAuth("", s.User, s.Pass, host)
		}
	}
	return smtp.SendMail(addr, auth, s.From, []string{to}, []byte(msg))
}

func NewSender(cfg config.Config, logger zerolog.Logger) domain.EmailSender {
	switch strings.ToLower(cfg.EmailProvider) {
	case "smtp":
		return &SMTPSender{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			User:     cfg.SMTPUser,
			Pass:     cfg.SMTPPass,
			From:     cfg.EmailFrom,
			FromName: cfg.EmailFromName,
			UseTLS:   cfg.SMTPTLS,
		}
	default:
		return LogSender{Logger: logger}
	}
}

func buildMessage(from string, to string, subject string, body string) string {
	headers := []string{
		fmt.Sprintf("From: %s", from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=\"utf-8\"",
		"Content-Transfer-Encoding: 8bit",
		"",
	}
	return strings.Join(headers, "\r\n") + body
}

func formatFrom(name string, email string) string {
	if name == "" {
		return email
	}
	return fmt.Sprintf("%s <%s>", name, email)
}
