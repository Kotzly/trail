import { useEffect, useState } from "react";
import { useAuthPortalFlow } from "../hooks/useAuthPortalFlow.js";
import { Icons } from "./Icon.js";
import { sessionBannerDismissedItem } from "@shared/config/storage-items.js";

export default function SessionExpiredBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { busy, startAuthFlow } = useAuthPortalFlow();

  // Load persisted dismiss state on mount
  useEffect(() => {
    let cancelled = false;
    sessionBannerDismissedItem
      .getValue()
      .then((val) => {
        if (!cancelled && val) setDismissed(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Watch for storage changes (e.g., if another panel instance dismisses)
  useEffect(() => {
    const unwatch = sessionBannerDismissedItem.watch((val) => {
      setDismissed(Boolean(val));
    });
    return unwatch;
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionBannerDismissedItem.setValue(true).catch(() => {});
  };

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
          "Sign in"
        )}
      </button>
      <button
        className="session-banner__dismiss"
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <Icons.X size={14} />
      </button>
    </div>
  );
}
