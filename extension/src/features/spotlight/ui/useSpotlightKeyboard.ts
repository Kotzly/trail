import { useEffect, useRef } from "react";
import { shouldApplyHintOnTab } from "./SpotlightHintRow.js";
import { buildClientContextActions } from "./SpotlightActionMenu.js";
import { IS_MAC } from "./platform.js";
import type { SpotlightActionResult, SpotlightSearchResult } from "./types.js";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type UseSpotlightKeyboardOptions = {
  isOpen: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  query: string;
  selectedItem: SpotlightSearchResult | null;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  hoveredGraphItem: SpotlightSearchResult | null;
  activeTreeId: string | null;
  hintCandidates: string[];
  activeHint: string | null;
  actionMenuActions: SpotlightActionResult[] | null;
  setActionMenuActions: (actions: SpotlightActionResult[] | null) => void;
  confirmingAction: SpotlightSearchResult | null;
  quickLookItem: SpotlightSearchResult | null;
  setQuickLookItem: (item: SpotlightSearchResult | null) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  drilldownScope: { treeId: string; treeName: string } | null;
  selectedFocusPane: "list" | "graph";
  setSelectedFocusPane: (pane: "list" | "graph") => void;
  setQuery: (q: string) => void;
  close: () => void;
  exitDrilldown: () => void;
  handleActivate: (item: SpotlightSearchResult) => Promise<void>;
  handleApplyHint: (hint: string) => void;
  handleConfirmDestructive: () => Promise<void>;
  setConfirmingAction: (action: SpotlightSearchResult | null) => void;
  flatItems: SpotlightSearchResult[];
  visibleFlatItems: SpotlightSearchResult[];
  selectedKeys: Set<string>;
  setSelectedKeys: (keys: Set<string>) => void;
  showPreview: boolean;
  toggleGraphPanel?: (() => void) | undefined;
  stepSnapPoint?: ((direction: 1 | -1) => void) | undefined;
  onSearchWeb?: ((query: string) => void) | null;
};

/**
 * Attaches a **native** capture-phase keydown listener to the backdrop element.
 *
 * React's synthetic `onKeyDownCapture` doesn't reliably fire inside Shadow DOM
 * content scripts (React 18 delegates events on the `createRoot` container, which
 * may not see composed keyboard events crossing the shadow boundary).  A native
 * `addEventListener('keydown', …, true)` on the backdrop div works regardless of
 * shadow-root topology because `keydown` is a composed event.
 */
export function useSpotlightKeyboard(options: UseSpotlightKeyboardOptions): void {
  // Keep a ref that always points at the latest options so the single native
  // listener (attached once per open) never holds a stale closure.
  const stateRef = useRef(options);
  // eslint-disable-next-line react-hooks/refs -- sync prop to ref for stable callback access
  stateRef.current = options;

  const queryClearedRef = useRef(false);
  useEffect(() => {
    queryClearedRef.current = false;
  }, [options.query]);

  useEffect(() => {
    if (!options.isOpen) return;

    const handler = (event: KeyboardEvent) => {
      const s = stateRef.current;

      switch (event.key) {
        case "Enter": {
          if (s.confirmingAction) {
            event.preventDefault();
            event.stopPropagation();
            void s.handleConfirmDestructive();
            return;
          }
          // Cmd+Enter (Mac) / Ctrl+Enter → search web
          const enterMod = IS_MAC ? event.metaKey : event.ctrlKey;
          if (enterMod && s.query.trim() && s.onSearchWeb) {
            event.preventDefault();
            event.stopPropagation();
            s.onSearchWeb(s.query.trim());
            return;
          }
          if (s.hoveredGraphItem) {
            event.preventDefault();
            event.stopPropagation();
            void s.handleActivate(s.hoveredGraphItem);
            return;
          }
          // Let cmdk or the item's onClick handle Enter for the selected item
          if (s.selectedItem) {
            event.preventDefault();
            event.stopPropagation();
            void s.handleActivate(s.selectedItem);
          }
          return;
        }
        case "Tab":
          if (shouldApplyHintOnTab(s.query, s.hintCandidates) && s.activeHint) {
            event.preventDefault();
            event.stopPropagation();
            s.handleApplyHint(s.activeHint);
            return;
          }
          if (s.selectedFocusPane === "list" && !s.showPreview) return;
          event.preventDefault();
          event.stopPropagation();
          s.setSelectedFocusPane(s.selectedFocusPane === "list" ? "graph" : "list");
          return;
        case "Backspace": {
          if (s.drilldownScope && s.query === "") {
            event.preventDefault();
            event.stopPropagation();
            s.exitDrilldown();
            return;
          }
          const clearCombo = IS_MAC ? event.metaKey : event.ctrlKey;
          if (clearCombo) {
            event.preventDefault();
            event.stopPropagation();
            if (s.query && !queryClearedRef.current) {
              queryClearedRef.current = true;
              s.setQuery("");
            }
          }
          return;
        }
        case "?":
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
            s.setHelpOpen(!s.helpOpen);
          }
          return;
        case "Escape":
          event.preventDefault();
          event.stopPropagation();
          if (s.confirmingAction) {
            s.setConfirmingAction(null);
          } else if (s.quickLookItem) {
            s.setQuickLookItem(null);
          } else if (s.actionMenuActions) {
            s.setActionMenuActions(null);
          } else if (s.helpOpen) {
            s.setHelpOpen(false);
          } else if (s.drilldownScope) {
            s.exitDrilldown();
          } else if (s.query && !queryClearedRef.current) {
            queryClearedRef.current = true;
            s.setQuery("");
          } else {
            s.close();
          }
          return;
        case "k": {
          if ((IS_MAC && event.metaKey) || (!IS_MAC && event.ctrlKey)) {
            event.preventDefault();
            event.stopPropagation();
            if (s.actionMenuActions) {
              s.setActionMenuActions(null);
              return;
            }
            if (!s.selectedItem) return;
            const actions = buildClientContextActions(s.selectedItem, s.activeTreeId);
            s.setActionMenuActions(actions.length > 0 ? actions : null);
          }
          return;
        }
        case "l":
        case "L": {
          if (((IS_MAC && event.metaKey) || (!IS_MAC && event.ctrlKey)) && event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            if (s.quickLookItem) {
              s.setQuickLookItem(null);
              return;
            }
            if (
              s.selectedItem &&
              (s.selectedItem.kind === "node" || s.selectedItem.kind === "tree")
            ) {
              s.setQuickLookItem(s.selectedItem);
            }
          }
          return;
        }
        case "\\": {
          // Cmd+\ (Mac) or Ctrl+\ (other) — toggle graph panel
          if ((IS_MAC && event.metaKey) || (!IS_MAC && event.ctrlKey)) {
            if (!s.toggleGraphPanel) return;
            event.preventDefault();
            event.stopPropagation();
            s.toggleGraphPanel();
          }
          return;
        }
        case "[":
        case "]": {
          // Cmd+Shift+[ / Cmd+Shift+] — step through snap points
          const mod = IS_MAC ? event.metaKey : event.ctrlKey;
          if (mod && event.shiftKey) {
            if (!s.stepSnapPoint) return;
            event.preventDefault();
            event.stopPropagation();
            s.stepSnapPoint(event.key === "[" ? -1 : 1);
          }
          return;
        }
        case "ArrowDown":
        case "ArrowUp": {
          event.preventDefault();
          event.stopPropagation();

          if (event.shiftKey) {
            // Multi-select: extend selection in the arrow direction
            const currentIdx = s.selectedItem
              ? s.flatItems.findIndex((i) => i.key === s.selectedItem!.key)
              : -1;
            if (currentIdx === -1) return;
            const nextIdx =
              event.key === "ArrowDown"
                ? Math.min(currentIdx + 1, s.flatItems.length - 1)
                : Math.max(currentIdx - 1, 0);
            const nextItem = s.flatItems[nextIdx];
            if (!nextItem) return;
            const next = new Set(s.selectedKeys);
            next.add(s.selectedItem!.key);
            next.add(nextItem.key);
            s.setSelectedKeys(next);
            s.setSelectedKey(nextItem.key);
            return;
          }

          // Normal arrow navigation through visible items (excluding collapsed)
          const items = s.visibleFlatItems;
          if (items.length === 0) return;
          const currentIdx = s.selectedKey ? items.findIndex((i) => i.key === s.selectedKey) : -1;
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIdx =
            currentIdx === -1 ? 0 : (currentIdx + delta + items.length) % items.length; // loop
          const nextItem = items[nextIdx];
          if (nextItem) {
            s.setSelectedKey(nextItem.key);
          }
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
    // Only re-attach when open state or container ref identity changes.
    // All mutable state is read from stateRef inside the handler.
  }, [options.isOpen, options.containerRef]);
}
