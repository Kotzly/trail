import TrailLogo from './TrailLogo.js';
import { useAuthPortalFlow } from '../hooks/useAuthPortalFlow.js';
import { guestWelcomeDismissedItem } from '@shared/config/storage-items.js';
import { Icons } from './Icon.js';

export default function WelcomeGate() {
  const { busy, silentSyncing, notice, startAuthFlow } = useAuthPortalFlow();

  const handleDismiss = () => {
    void guestWelcomeDismissedItem.setValue(true);
  };

  return (
    <div className="auth-gate">
      <div className="auth-gate__content">
        <TrailLogo className="auth-gate__logo" animated label="Trail" />

        <h1 className="auth-gate__title">Welcome to Trail</h1>
        <p className="auth-gate__subtitle">
          Trail maps your browsing into a visual tree.
          <br />
          Sign in to sync across devices.
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
            'Continue with Trail'
          )}
        </button>

        <button
          className="auth-gate__link-btn"
          type="button"
          onClick={handleDismiss}
        >
          Sign in later
        </button>

        {notice ? <p className="auth-gate__notice">{notice}</p> : null}
      </div>
    </div>
  );
}
