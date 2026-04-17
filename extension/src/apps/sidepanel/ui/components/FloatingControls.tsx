import { useCallback } from "react";
import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import SettingsDropdown from "./SettingsPopover.js";
import CommandPalette from "./CommandPalette.js";
import { Button } from "@ui/components/ui/button";
import { ButtonGroup } from "@ui/components/ui/button-group";
import { ButtonTooltip } from "@ui/components/button-tooltip";

const UNDO_KEYS = ["meta", "Z"] as const;
const REDO_KEYS = ["meta", "shift", "Z"] as const;

export default function FloatingControls() {
  const commandState = useStore((state) => state.commandState);
  const editorActive = useStore((state) => state.editorMode.active);
  const setCommandState = useStore((state) => state.setCommandState);

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
        </ButtonGroup>
      </div>
    </div>
  );
}
