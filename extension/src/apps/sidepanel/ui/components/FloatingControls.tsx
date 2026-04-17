import { useCallback, useEffect, useState } from "react";
import { redo, undo } from "../../api/commands.js";
import { listTombstones } from "../../api/cleanup.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import SettingsDropdown from "./SettingsPopover.js";
import CommandPalette from "./CommandPalette.js";
import { Button } from "@ui/components/ui/button";
import { ButtonGroup } from "@ui/components/ui/button-group";
import { ButtonTooltip } from "@ui/components/button-tooltip";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const UNDO_KEYS = ["meta", "Z"] as const;
const REDO_KEYS = ["meta", "shift", "Z"] as const;

export default function FloatingControls() {
  const commandState = useStore((state) => state.commandState);
  const editorActive = useStore((state) => state.editorMode.active);
  const setCommandState = useStore((state) => state.setCommandState);
  const setRecentlyCleanedOpen = useStore((state) => state.setRecentlyCleanedOpen);
  const treeUpdate = useStore((state) => state.treeUpdate);
  const [hasRecentCleanup, setHasRecentCleanup] = useState(false);

  // Refresh the recent-cleanup dot when tree updates fire — a glance
  // prune is the kind of silent mutation that doesn't otherwise surface
  // in the UI, so poll on the next tree-update broadcast.
  useEffect(() => {
    let cancelled = false;
    listTombstones()
      .then((list) => {
        if (cancelled) return;
        const cutoff = Date.now() - RECENT_WINDOW_MS;
        setHasRecentCleanup(list.some((t) => t.removedAt >= cutoff));
      })
      .catch(() => {
        /* non-fatal: badge stays off */
      });
    return () => {
      cancelled = true;
    };
  }, [treeUpdate]);

  const undoLabel = commandState?.nextUndoDesc ? `Undo: ${commandState.nextUndoDesc}` : "Undo";
  const redoLabel = commandState?.nextRedoDesc ? `Redo: ${commandState.nextRedoDesc}` : "Redo";

  const handleUndo = useCallback(async () => {
    try {
      setCommandState(await undo());
    } catch (error) {
      console.error("Failed to undo:", error);
    }
  }, [setCommandState]);

  const handleRedo = useCallback(async () => {
    try {
      setCommandState(await redo());
    } catch (error) {
      console.error("Failed to redo:", error);
    }
  }, [setCommandState]);

  return (
    <div className="pointer-events-none fixed top-3 right-3 left-3 z-[900] flex items-start justify-between gap-2">
      <div className="pointer-events-auto flex max-w-full min-w-0 items-start gap-2">
        <ButtonGroup>
          <ButtonTooltip label={undoLabel} keys={UNDO_KEYS}>
            <Button
              id="undoBtn"
              variant="outline"
              size="icon-sm"
              type="button"
              aria-label={undoLabel}
              disabled={!commandState?.canUndo}
              onClick={handleUndo}
            >
              <Icons.Undo2 />
            </Button>
          </ButtonTooltip>
          <ButtonTooltip label={redoLabel} keys={REDO_KEYS}>
            <Button
              id="redoBtn"
              variant="outline"
              size="icon-sm"
              type="button"
              aria-label={redoLabel}
              disabled={!commandState?.canRedo}
              onClick={handleRedo}
            >
              <Icons.Redo2 />
            </Button>
          </ButtonTooltip>
        </ButtonGroup>

        <ButtonGroup>
          {!editorActive && <PinnedDropdown />}
          <TreeDropdown />
        </ButtonGroup>
      </div>

      <div className="pointer-events-auto flex flex-row-reverse items-start gap-2">
        <ButtonGroup>
          <SettingsDropdown />
          <CommandPalette />
          <ButtonTooltip label="Recently cleaned">
            <Button
              id="recentlyCleanedBtn"
              variant="outline"
              size="icon-sm"
              type="button"
              aria-label="Recently cleaned"
              className="relative"
              onClick={() => setRecentlyCleanedOpen(true)}
            >
              <Icons.History />
              {hasRecentCleanup && (
                <span
                  aria-hidden
                  className="bg-primary absolute top-1 right-1 size-1.5 rounded-full"
                />
              )}
            </Button>
          </ButtonTooltip>
        </ButtonGroup>
      </div>
    </div>
  );
}
