"use client";

import type { CSSProperties } from "react";

interface LoginViewProps {
  error: string | null;
  isLoading: boolean;
  onContinueWithGoogle: () => void;
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

const primaryButtonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
};

export function LoginView({
  error,
  isLoading,
  onContinueWithGoogle,
}: LoginViewProps) {
  return (
    <main style={mainStyle}>
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>trail</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Continue with Google to sign in.
        </p>
      </header>

      <button
        type="button"
        onClick={onContinueWithGoogle}
        disabled={isLoading}
        style={{
          ...primaryButtonStyle,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.75 : 1,
        }}
      >
        {isLoading ? "Google..." : "Continue with Google"}
      </button>

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}

