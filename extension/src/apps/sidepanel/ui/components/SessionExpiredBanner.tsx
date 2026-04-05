import { useEffect, useState } from "react";
import { useAuthPortalFlow } from "../hooks/useAuthPortalFlow.js";
import { Icons } from "./Icon.js";
import { sessionBannerDismissedItem } from "@shared/config/storage-items.js";
import { Button } from "@ui/components/ui/button";

export default function SessionExpiredBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { busy, startAuthFlow } = useAuthPortalFlow();

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
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted border-b border-border text-xs text-muted-foreground z-50">
      <span className="flex-1 min-w-0">Sync requires sign-in</span>
      <Button
        variant="outline"
        size="xs"
        type="button"
        onClick={() => void startAuthFlow()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Icons.Loader2 className="animate-spin" data-icon="inline-start" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <Icons.X />
      </Button>
    </div>
  );
}
