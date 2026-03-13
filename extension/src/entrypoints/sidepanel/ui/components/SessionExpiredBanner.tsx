import { useState } from 'react';
import { useAuthPortalFlow } from '../hooks/useAuthPortalFlow.js';
import { Icons } from './Icon.js';

export default function SessionExpiredBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { busy, startAuthFlow } = useAuthPortalFlow();

  if (dismissed) return null;

  return (
    <div className="session-banner">
      <span className="session-banner__text">Sync requires sign-in</span>
      <button
        className="session-banner__action"
        type="button"
        onClick={() => void startAuthFlow()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Icons.Maximize size={12} className="auth-gate__spinner" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </button>
      <button
        className="session-banner__dismiss"
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <Icons.X size={14} />
      </button>
    </div>
  );
}
