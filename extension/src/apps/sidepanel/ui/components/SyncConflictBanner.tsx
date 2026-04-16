import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../state/store.js";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/ui/alert";
import { Button } from "@ui/components/ui/button";
import { Icons } from "./Icon.js";
import { captureEvent } from "@shared/lib/observability.js";
import { formatRelativeTime } from "../shared/format.js";

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

  const timeAgo = formatRelativeTime(conflict?.serverUpdatedAt ?? null);

  return (
    <AnimatePresence>
      {conflict ? (
        <motion.div
          aria-live="polite"
          aria-atomic="true"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-0 right-0 left-0 z-[950]"
        >
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-destructive/20 dark:bg-destructive/20 rounded-none border-x-0 border-t-0 backdrop-blur-sm"
          >
            <Icons.AlertTriangle />
            <AlertTitle>Tree updated on another device</AlertTitle>
            <AlertDescription>Last remote change {timeAgo}.</AlertDescription>
            <div className="col-start-2 mt-1 flex gap-2">
              <Button size="sm" variant="outline" type="button" disabled={busy} onClick={keepMine}>
                Keep mine
              </Button>
              <Button size="sm" variant="default" type="button" disabled={busy} onClick={useServer}>
                Use server
              </Button>
            </div>
          </Alert>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
