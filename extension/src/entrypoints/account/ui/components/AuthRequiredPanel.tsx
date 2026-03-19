import { useCallback, useState } from "react";
import { sendRpcMessage } from "@shared/rpc/client.js";
import { rpc } from "@shared/rpc/contracts.js";

export default function AuthRequiredPanel() {
  const [busy, setBusy] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await sendRpcMessage(rpc.oauthInteractiveLogin());
    } catch (err) {
      console.error("Sign-in failed:", err);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="auth-required-panel">
      <div className="auth-required-panel__icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="auth-required-panel__title">Sign in to access</h2>
      <p className="auth-required-panel__description">
        This feature requires an account. Sign in to get started.
      </p>
      <button
        type="button"
        className="account-btn account-btn--primary"
        onClick={() => void handleSignIn()}
        disabled={busy}
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </div>
  );
}
