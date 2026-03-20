import TrailLogo from "./TrailLogo.js";
import { useAuthPortalFlow } from "../hooks/useAuthPortalFlow.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";

/**
 * Full-screen auth gate — blocks the entire extension UI when the user
 * is not authenticated. Graph components are NOT mounted behind this;
 * the gate replaces them entirely via conditional render in App.tsx.
 *
 * PRD §7.1: Trail logo (centered), "Sign in to start" text,
 * "Continue with Trail" button. Opens the Trail account page for Google auth.
 */
export default function AuthGate() {
  const { busy, silentSyncing, notice, startAuthFlow } = useAuthPortalFlow();
  const sessionExpired = useStore((state) => state.account.sessionExpired);

  return (
    <div className="auth-gate">
      <div className="auth-gate__content">
        <TrailLogo className="auth-gate__logo" animated label="Trail" />

        <h1 className="auth-gate__title">
          {sessionExpired ? "Session expired" : "Sign in to start"}
        </h1>
        <p className="auth-gate__subtitle">
          {sessionExpired ? (
            "Your session has expired. Sign in again to continue."
          ) : (
            <>
              Trail maps your browsing into a visual tree.
              <br />
              Sign in to get started.
            </>
          )}
        </p>

        <button
          className="auth-gate__btn"
          type="button"
          onClick={() => void startAuthFlow()}
          disabled={busy || silentSyncing}
        >
          {busy ? (
            <>
              <Icons.Maximize size={14} className="auth-gate__spinner" />
              Waiting for sign in…
            </>
          ) : silentSyncing ? (
            <>
              <Icons.Maximize size={14} className="auth-gate__spinner" />
              Checking web session…
            </>
          ) : (
            "Continue with Trail"
          )}
        </button>

        {notice ? <p className="auth-gate__notice">{notice}</p> : null}
      </div>
    </div>
  );
}
