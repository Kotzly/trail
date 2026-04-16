import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../state/store.js";
import { Button } from "@ui/components/ui/button";
import { Icons } from "./Icon.js";
import { cn } from "@ui/lib/utils";
import { captureEvent } from "@shared/lib/observability.js";

/**
 * Sticky banner shown when the sync engine detects another device has
 * edited the active tree since our last known state. Two resolutions:
 *
 * - **Keep mine**: user clears the conflict marker; next successful push
 *   will overwrite the server copy (server's bump_at will be newer, LWW
 *   from there).
 * - **Use server**: reloads the sidepanel, which picks up the latest
 *   server tree through the normal boot flow (once pull-on-wake lands in
 *   Wave 9 this becomes a proper merge).
 */
export default function SyncConflictBanner() {
  const conflict = useStore((s) => s.syncConflict);
  const clearConflict = useStore((s) => s.setSyncConflict);
  const [busy, setBusy] = useState(false);

  const keepMine = () => {
    setBusy(true);
    clearConflict(null);
    captureEvent("sync_failed", { reason: "conflict_kept_local" });
    setBusy(false);
  };

  const useServer = () => {
    setBusy(true);
    captureEvent("sync_failed", { reason: "conflict_used_server" });
    // The simplest safe resolution today: reload. A full merge UI lands
    // in Wave 9 once pull-to-local is wired.
    window.location.reload();
  };

  const serverDate = conflict ? new Date(conflict.serverUpdatedAt) : new Date();
  const timeAgo = formatRelativeTime(serverDate);

  return (
    <AnimatePresence>
      {conflict ? (
        <motion.div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "fixed top-0 right-0 left-0 z-[950]",
            "pointer-events-auto flex items-center gap-2 border-b px-3 py-2",
            "bg-destructive/10 border-destructive/20 text-destructive-foreground",
            "dark:bg-destructive/20 backdrop-blur-sm",
          )}
        >
          <Icons.AlertTriangle className="size-4 shrink-0" />
          <div className="min-w-0 flex-1 text-[12px] leading-tight">
            <div className="font-semibold">Tree updated on another device</div>
            <div className="text-muted-foreground">Last remote change {timeAgo}.</div>
          </div>
          <Button size="sm" variant="outline" type="button" disabled={busy} onClick={keepMine}>
            Keep mine
          </Button>
          <Button size="sm" variant="default" type="button" disabled={busy} onClick={useServer}>
            Use server
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString();
}
