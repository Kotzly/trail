"use client";

import type { ChangeEvent, CSSProperties } from "react";

interface LoginViewProps {
  email: string;
  name: string;
  otp: string;
  password: string;
  status: string | null;
  error: string | null;
  isSending: boolean;
  isSigningIn: boolean;
  isPasswordSigningIn: boolean;
  isSigningUp: boolean;
  oauthLoading: "google" | "github" | null;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSendOtp: () => void;
  onSignIn: () => void;
  onPasswordSignIn: () => void;
  onSignUp: () => void;
  onSocial: (provider: "google" | "github") => void;
}

const mainStyle: CSSProperties = {
  margin: "0 auto",
  maxWidth: "420px",
  padding: "48px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
};

const socialButtonStyle: CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
};

const onInputChange =
  (handler: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) =>
    handler(event.target.value);

export function LoginView({
  email,
  name,
  otp,
  password,
  status,
  error,
  isSending,
  isSigningIn,
  isPasswordSigningIn,
  isSigningUp,
  oauthLoading,
  onEmailChange,
  onNameChange,
  onOtpChange,
  onPasswordChange,
  onSendOtp,
  onSignIn,
  onPasswordSignIn,
  onSignUp,
  onSocial,
}: LoginViewProps) {
  return (
    <main style={mainStyle}>
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Trail вход</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Получите одноразовый код, войдите по паролю или через OAuth.
        </p>
      </header>

      <label style={labelStyle}>
        Email
        <input
          type="email"
          value={email}
          onChange={onInputChange(onEmailChange)}
          placeholder="you@company.com"
          autoComplete="email"
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Имя
        <input
          type="text"
          value={name}
          onChange={onInputChange(onNameChange)}
          placeholder="Имя"
          autoComplete="name"
          style={inputStyle}
        />
      </label>

      <button
        type="button"
        onClick={onSendOtp}
        disabled={isSending}
        style={{
          ...primaryButtonStyle,
          cursor: isSending ? "not-allowed" : "pointer",
        }}
      >
        {isSending ? "Отправляем код..." : "Отправить код"}
      </button>

      <label style={labelStyle}>
        Код из письма
        <input
          type="text"
          value={otp}
          onChange={onInputChange(onOtpChange)}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          style={inputStyle}
        />
      </label>

      <button
        type="button"
        onClick={onSignIn}
        disabled={isSigningIn}
        style={{
          ...secondaryButtonStyle,
          cursor: isSigningIn ? "not-allowed" : "pointer",
        }}
      >
        {isSigningIn ? "Входим по коду..." : "Войти по коду"}
      </button>

      <label style={labelStyle}>
        Пароль
        <input
          type="password"
          value={password}
          onChange={onInputChange(onPasswordChange)}
          placeholder="Введите пароль"
          autoComplete="current-password"
          style={inputStyle}
        />
      </label>

      <button
        type="button"
        onClick={onPasswordSignIn}
        disabled={isPasswordSigningIn}
        style={{
          ...secondaryButtonStyle,
          cursor: isPasswordSigningIn ? "not-allowed" : "pointer",
        }}
      >
        {isPasswordSigningIn ? "Входим по паролю..." : "Войти по паролю"}
      </button>

      <button
        type="button"
        onClick={onSignUp}
        disabled={isSigningUp}
        style={{
          ...primaryButtonStyle,
          cursor: isSigningUp ? "not-allowed" : "pointer",
        }}
      >
        {isSigningUp ? "Регистрируем..." : "Зарегистрироваться"}
      </button>

      <div
        style={{
          marginTop: "8px",
          fontSize: "14px",
          color: "#6b7280",
        }}
      >
        Или продолжить через
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          type="button"
          onClick={() => onSocial("google")}
          disabled={oauthLoading === "google"}
          style={{
            ...socialButtonStyle,
            cursor: oauthLoading === "google" ? "not-allowed" : "pointer",
          }}
        >
          {oauthLoading === "google" ? "Google..." : "Google"}
        </button>
        <button
          type="button"
          onClick={() => onSocial("github")}
          disabled={oauthLoading === "github"}
          style={{
            ...socialButtonStyle,
            cursor: oauthLoading === "github" ? "not-allowed" : "pointer",
          }}
        >
          {oauthLoading === "github" ? "GitHub..." : "GitHub"}
        </button>
      </div>

      {status ? (
        <p role="status" style={{ margin: 0, color: "#047857" }}>
          {status}
        </p>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
