import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "../lib/utils.js";
import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import FloatingSearch from "./FloatingSearch.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import TagFilterDropdown from "./tags/TagFilterDropdown.js";
import SettingsDropdown from "./SettingsPopover.js";

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
      className={cn("floating-controls", controlsCompact && "is-compact")}
      data-search-expanded={searchExpanded ? "true" : "false"}
    >
      <div ref={leftRef} className="floating-controls-left">
        <div className="floating-island">
          <button
            id="undoBtn"
            className="matte-circle-btn orb-button"
            type="button"
            aria-label={undoTooltip}
            data-tooltip={undoTooltip}
            disabled={!commandState?.canUndo}
            onClick={handleUndo}
          >
            <Icons.Undo2 size={18} />
          </button>
          <button
            id="redoBtn"
            className="matte-circle-btn orb-button"
            type="button"
            aria-label={redoTooltip}
            data-tooltip={redoTooltip}
            disabled={!commandState?.canRedo}
            onClick={handleRedo}
          >
            <Icons.Redo2 size={18} />
          </button>
        </div>

        <div className="floating-island">
          {!editorActive ? <PinnedDropdown /> : null}
          <TreeDropdown />
          {!editorActive ? <TagFilterDropdown /> : null}
        </div>
      </div>

      <div ref={rightRef} className="floating-controls-right">
        <FloatingSearch inputRef={searchInputRef} onExpandedChange={setSearchExpanded} />
        <div className="floating-island">
          <SettingsDropdown />
        </div>
      </div>
    </div>
  );
}
