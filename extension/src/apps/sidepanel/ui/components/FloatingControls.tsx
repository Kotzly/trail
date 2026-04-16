import { useCallback, useRef } from "react";
import { cn } from "@ui/lib/utils";
import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import SettingsDropdown from "./SettingsPopover.js";
import { Button } from "@ui/components/ui/button";

export default function FloatingControls() {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const editorActive = useStore((state) => state.editorMode.active);
  const setCommandState = useStore((state) => state.setCommandState);
  const setCommandPaletteOpen = useStore((state) => state.setCommandPaletteOpen);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  // Search button toggle. The button lives outside the dialog portal, so
  // Radix's DismissableLayer fires onPointerDownOutside → closes the
  // palette BEFORE our onClick can read the "still-open" state. We snapshot
  // the live store value on pointerdown (React's delegated handler runs
  // before Radix's document-level listener) and skip the reopen on click
  // when the palette was open just before the press.
  const searchWasOpenRef = useRef(false);
  const handleSearchPointerDown = useCallback(() => {
    searchWasOpenRef.current = useStore.getState().commandPalette.open;
  }, []);
  const handleSearchClick = useCallback(() => {
    if (searchWasOpenRef.current) return;
    setCommandPaletteOpen(true);
  }, [setCommandPaletteOpen]);

  const searchShortcut = metaKey ? `${metaKey.short}+K` : "Ctrl+K";
  const searchTooltip = `Search (${searchShortcut})`;

  const undoShortcut = metaKey ? `${metaKey.short}+z (${metaKey.long}+z)` : "Ctrl+Z";
  const redoShortcut = metaKey ? `${metaKey.short}+⇧+z (${metaKey.long}+shift+z)` : "Ctrl+Shift+Z";
  const undoTooltip = commandState?.nextUndoDesc
    ? `Undo: ${commandState.nextUndoDesc} (${undoShortcut})`
    : `Undo (${undoShortcut})`;
  const redoTooltip = commandState?.nextRedoDesc
    ? `Redo: ${commandState.nextRedoDesc} (${redoShortcut})`
    : `Redo (${redoShortcut})`;

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
      <div
        ref={leftRef}
        className={cn(
          "pointer-events-auto flex max-w-full min-w-0 items-start gap-2 transition-all duration-200",
        )}
      >
        <div className="bg-background/90 border-border flex gap-1 rounded-full border p-0.5 shadow-sm backdrop-blur-sm">
          <Button
            id="undoBtn"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            type="button"
            aria-label={undoTooltip}
            data-tooltip={undoTooltip}
            disabled={!commandState?.canUndo}
            onClick={handleUndo}
          >
            <Icons.Undo2 />
          </Button>
          <Button
            id="redoBtn"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            type="button"
            aria-label={redoTooltip}
            data-tooltip={redoTooltip}
            disabled={!commandState?.canRedo}
            onClick={handleRedo}
          >
            <Icons.Redo2 />
          </Button>
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
          <Button
            id="searchBtn"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            type="button"
            aria-label={searchTooltip}
            data-tooltip={searchTooltip}
            onPointerDown={handleSearchPointerDown}
            onClick={handleSearchClick}
          >
            <Icons.Search />
          </Button>
        </div>
      </div>
    </div>
  );
}
