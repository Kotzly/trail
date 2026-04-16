import { useRef } from "react";
import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import SettingsDropdown from "./SettingsPopover.js";
import CommandPalette from "./CommandPalette.js";
import { Button } from "@ui/components/ui/button";
import { ButtonTooltip } from "@ui/components/button-tooltip";

export default function FloatingControls() {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const isMac = useStore((state) => state.isMac);
  const editorActive = useStore((state) => state.editorMode.active);
  const setCommandState = useStore((state) => state.setCommandState);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const meta = metaKey?.short ?? "Ctrl";
  const shift = isMac ? "⇧" : "Shift";
  const undoKeys = [meta, "Z"];
  const redoKeys = [meta, shift, "Z"];
  const undoLabel = commandState?.nextUndoDesc ? `Undo: ${commandState.nextUndoDesc}` : "Undo";
  const redoLabel = commandState?.nextRedoDesc ? `Redo: ${commandState.nextRedoDesc}` : "Redo";

  const handleUndo = async () => {
    try {
      const state = await undo();
      setCommandState(state);
    } catch (error) {
      console.error("Failed to undo:", error);
    }
  };

  const handleRedo = async () => {
    try {
      const state = await redo();
      setCommandState(state);
    } catch (error) {
      console.error("Failed to redo:", error);
    }
  };

  return (
    <div
      ref={controlsRef}
      className="pointer-events-none fixed top-3 right-3 left-3 z-[900] flex items-start justify-between gap-2"
    >
      {/* Left cluster: undo/redo + pinned/trees */}
      <div ref={leftRef} className="pointer-events-auto flex max-w-full min-w-0 items-start gap-2">
        <div className="bg-background/90 border-border flex gap-1 rounded-full border p-0.5 shadow-sm backdrop-blur-sm">
          <ButtonTooltip label={undoLabel} keys={undoKeys}>
            <Button
              id="undoBtn"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              type="button"
              aria-label={undoLabel}
              disabled={!commandState?.canUndo}
              onClick={handleUndo}
            >
              <Icons.Undo2 />
            </Button>
          </ButtonTooltip>
          <ButtonTooltip label={redoLabel} keys={redoKeys}>
            <Button
              id="redoBtn"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              type="button"
              aria-label={redoLabel}
              disabled={!commandState?.canRedo}
              onClick={handleRedo}
            >
              <Icons.Redo2 />
            </Button>
          </ButtonTooltip>
        </div>

        <div className="bg-background/90 border-border flex gap-1 rounded-full border p-0.5 shadow-sm backdrop-blur-sm">
          {!editorActive && <PinnedDropdown />}
          <TreeDropdown />
        </div>
      </div>

      {/* Right cluster: search + settings */}
      <div ref={rightRef} className="pointer-events-auto flex flex-row-reverse items-start gap-2">
        <div className="bg-background/90 border-border flex gap-1 rounded-full border p-0.5 shadow-sm backdrop-blur-sm">
          <SettingsDropdown />
          <CommandPalette />
        </div>
      </div>
    </div>
  );
}
