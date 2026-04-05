import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@ui/lib/utils";
import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import FloatingSearch from "./FloatingSearch.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import SettingsDropdown from "./SettingsPopover.js";
import { Button } from "@ui/components/ui/button";

type FloatingControlsProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
};

export default function FloatingControls({ searchInputRef }: FloatingControlsProps) {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const editorActive = useStore((state) => state.editorMode.active);
  const setCommandState = useStore((state) => state.setCommandState);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [controlsCompact, setControlsCompact] = useState(false);
  const controlsCompactRef = useRef(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const leftBaselineRef = useRef(0);

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

  useLayoutEffect(() => {
    const container = controlsRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!container || !left || !right) return;

    const measure = () => {
      const containerWidth = container.getBoundingClientRect().width;
      const rightWidth = right.getBoundingClientRect().width;
      const leftWidth = left.getBoundingClientRect().width;
      const isCompact = controlsCompactRef.current;
      if (!isCompact) {
        leftBaselineRef.current = leftWidth;
      }
      const baseLeft = leftBaselineRef.current || leftWidth;
      const styles = window.getComputedStyle(container);
      const gapValue = styles.columnGap || styles.gap || "0";
      const gap = Number.parseFloat(gapValue) || 0;
      const needsCompact = searchExpanded && baseLeft + rightWidth + gap > containerWidth;
      if (needsCompact !== isCompact) {
        controlsCompactRef.current = needsCompact;
        setControlsCompact(needsCompact);
      }
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    observer.observe(left);
    observer.observe(right);
    return () => observer.disconnect();
  }, [searchExpanded]);

  return (
    <div
      ref={controlsRef}
      className="fixed top-3 left-3 right-3 flex justify-between items-start gap-2 z-[900] pointer-events-none"
      data-search-expanded={searchExpanded ? "true" : "false"}
    >
      {/* Left cluster: undo/redo + pinned/trees */}
      <div
        ref={leftRef}
        className={cn(
          "flex gap-2 items-start pointer-events-auto min-w-0 max-w-full transition-all duration-200",
          controlsCompact && "max-w-0 opacity-0 -translate-x-2 pointer-events-none overflow-hidden",
        )}
      >
        <div className="flex gap-1 bg-background/90 backdrop-blur-sm rounded-full border border-border shadow-sm p-0.5">
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

        <div className="flex gap-1 bg-background/90 backdrop-blur-sm rounded-full border border-border shadow-sm p-0.5">
          {!editorActive && <PinnedDropdown />}
          <TreeDropdown />
        </div>
      </div>

      {/* Right cluster: search + settings */}
      <div ref={rightRef} className="flex flex-row-reverse gap-2 items-start pointer-events-auto">
        <FloatingSearch inputRef={searchInputRef} onExpandedChange={setSearchExpanded} />
        <div className="bg-background/90 backdrop-blur-sm rounded-full border border-border shadow-sm p-0.5">
          <SettingsDropdown />
        </div>
      </div>
    </div>
  );
}
