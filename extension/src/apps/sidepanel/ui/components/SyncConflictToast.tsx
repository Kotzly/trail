/**
 * Sync-conflict persistent Sonner toast.
 *
 * Replaces the old fixed-top banner + modal dialog. When the sync
 * engine fires SYNC_CONFLICT, we show a custom Sonner toast that stays
 * until the conflict is resolved. Three resolution paths:
 *
 *   - Fork tree — duplicate the current local tree as a new tree, then
 *     force-pull the server copy into the original. No data loss.
 *   - Keep mine — atomic upsert that overwrites the server with the
 *     local copy, with optimistic-concurrency re-check.
 *   - Use server — atomic write of the server copy into the local slot.
 */

import { useEffect, useRef } from "react";
import { i18n } from "#i18n";
import { toast } from "sonner";

import { Button } from "@ui/components/ui/button";
import { ButtonGroup } from "@ui/components/ui/button-group";
import { Icons } from "@ui/components/icons";
import { captureEvent } from "@shared/lib/observability.js";
import { fromCompact, toCompact } from "@shared/lib/compact-mapper.js";

import { useStore } from "../state/store.js";
import {
  applyConflictMerge,
  fetchConflictPreview,
  forkTreeFromConflict,
  getPendingConflicts,
} from "../../api/tree.js";
import { formatRelativeTime } from "../shared/format.js";
import { showUiToast } from "../notifications/sonner-adapter.js";

/**
 * Mount inside the sidepanel shell. Renders nothing — just manages the
 * lifecycle of a single persistent Sonner toast keyed by
 * `(treeId, serverUpdatedAt)`.
 */
export default function SyncConflictToastMount(): null {
  useSyncConflictToast();
  return null;
}

function useSyncConflictToast(): void {
  const conflict = useStore((s) => s.syncConflict);
  const setSyncConflict = useStore((s) => s.setSyncConflict);
  const clearConflict = useStore((s) => s.clearConflict);
  const toastIdRef = useRef<string | number | null>(null);
  const busyRef = useRef(false);

  // On mount, rehydrate from the background's in-memory pending map.
  // This is what rescues the toast after the user closes and reopens
  // the sidepanel — the conflict state lives in the SW, not in the
  // disposable sidepanel React tree.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getPendingConflicts();
      if (cancelled) return;
      const first = res.conflicts[0];
      if (first) {
        setSyncConflict({
          treeId: first.treeId,
          serverUpdatedAt: first.serverUpdatedAt,
          serverDeviceId: first.serverDeviceId,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSyncConflict]);

  useEffect(() => {
    if (!conflict) {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    captureEvent("sync_conflict_shown", {
      treeId: conflict.treeId,
    });

    const toastKey = `conflict:${conflict.treeId}:${conflict.serverUpdatedAt}`;

    // Dismiss any outdated toast for the same tree before showing a
    // fresh one (e.g., server bumped while the toast was open).
    if (toastIdRef.current !== null && toastIdRef.current !== toastKey) {
      toast.dismiss(toastIdRef.current);
    }

    toastIdRef.current = toast.custom(
      (id) => (
        <SyncConflictToast
          toastId={id}
          treeId={conflict.treeId}
          serverUpdatedAt={conflict.serverUpdatedAt}
          busyRef={busyRef}
          onResolved={() => {
            toast.dismiss(id);
            clearConflict();
          }}
        />
      ),
      {
        id: toastKey,
        duration: Infinity,
        // Isolate the persistent conflict toast from the bottom-right
        // stack where transient notifications queue up. Keeps it
        // visible even when "tree saved" / "tab merged" etc. stack 4
        // deep in the normal position.
        position: "top-center",
        dismissible: false,
      },
    );
  }, [conflict, clearConflict]);
}

type ToastProps = {
  toastId: string | number;
  treeId: string;
  serverUpdatedAt: string;
  busyRef: React.RefObject<boolean>;
  onResolved: () => void;
};

function SyncConflictToast({
  toastId: _toastId,
  treeId,
  serverUpdatedAt,
  busyRef,
  onResolved,
}: ToastProps) {
  const timeAgo = formatRelativeTime(serverUpdatedAt);

  const wrap = (fn: () => Promise<void>) => async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await fn();
    } finally {
      busyRef.current = false;
    }
  };

  const onFork = wrap(async () => {
    const res = await forkTreeFromConflict(treeId);
    if (!res.ok) {
      showUiToast({
        message: i18n.t("sidepanel.syncConflict.forkFailed", [res.reason]),
        icon: "AlertTriangle",
      });
      return;
    }
    showUiToast({
      message: i18n.t("sidepanel.syncConflict.forkSuccess"),
      icon: "Check",
    });
    onResolved();
  });

  const onKeepMine = wrap(async () => {
    const preview = await fetchConflictPreview(treeId);
    if (!preview.ok) {
      showUiToast({
        message: i18n.t("sidepanel.syncConflict.serverUnreachable"),
        icon: "AlertTriangle",
      });
      return;
    }
    const serverJSON = fromCompact(preview.value.serverPayloadCompact);
    const activeMeta = useStore.getState().trees.active;
    const mine = useStore.getState().treeJSON ?? serverJSON;
    const res = await applyConflictMerge({
      treeId,
      expectedServerUpdatedAt: preview.value.serverUpdatedAt,
      expectedActiveTreeId: activeMeta?.id === treeId ? treeId : null,
      mergedTreeCompact: toCompact(mine),
      mergedLabel: {
        label: activeMeta?.label ?? "",
        source: activeMeta?.labelSource ?? "user",
        updatedAt: activeMeta?.labelUpdatedAt ?? Date.now(),
      },
      mode: "keep-mine",
    });
    if (!res.ok) {
      showUiToast({
        message: i18n.t("sidepanel.syncConflict.keepMineFailed", [res.error.reason]),
        icon: "AlertTriangle",
      });
      return;
    }
    showUiToast({
      message: i18n.t("sidepanel.syncConflict.keepMineSuccess"),
      icon: "Check",
    });
    onResolved();
  });

  const onUseServer = wrap(async () => {
    const preview = await fetchConflictPreview(treeId);
    if (!preview.ok) {
      showUiToast({
        message: i18n.t("sidepanel.syncConflict.serverUnreachable"),
        icon: "AlertTriangle",
      });
      return;
    }
    const serverJSON = fromCompact(preview.value.serverPayloadCompact);
    const activeMeta = useStore.getState().trees.active;
    const res = await applyConflictMerge({
      treeId,
      expectedServerUpdatedAt: preview.value.serverUpdatedAt,
      expectedActiveTreeId: activeMeta?.id === treeId ? treeId : null,
      mergedTreeCompact: toCompact(serverJSON),
      mergedLabel: preview.value.serverLabel,
      mode: "use-server",
    });
    if (!res.ok) {
      showUiToast({
        message: i18n.t("sidepanel.syncConflict.useServerFailed", [res.error.reason]),
        icon: "AlertTriangle",
      });
      return;
    }
    showUiToast({
      message: i18n.t("sidepanel.syncConflict.useServerSuccess"),
      icon: "Check",
    });
    onResolved();
  });

  return (
    <div className="bg-popover text-popover-foreground flex w-[22rem] flex-col gap-3 border p-4 shadow-lg">
      <div className="flex items-start gap-2">
        <Icons.AlertTriangle className="text-destructive mt-0.5 shrink-0" size={16} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="text-sm font-medium">{i18n.t("sidepanel.syncConflict.title")}</div>
          <div className="text-muted-foreground text-xs">
            {i18n.t("sidepanel.syncConflict.subtitle", [timeAgo])}
          </div>
        </div>
      </div>
      <ButtonGroup className="w-full">
        <Button size="sm" onClick={onFork} className="press-feedback">
          {i18n.t("sidepanel.syncConflict.fork")}
        </Button>
        <Button size="sm" variant="outline" onClick={onKeepMine} className="press-feedback">
          {i18n.t("sidepanel.syncConflict.keepMine")}
        </Button>
        <Button size="sm" variant="outline" onClick={onUseServer} className="press-feedback">
          {i18n.t("sidepanel.syncConflict.useServer")}
        </Button>
      </ButtonGroup>
    </div>
  );
}
