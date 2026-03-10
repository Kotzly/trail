import { useCallback } from 'react';
import { shouldApplyHintOnTab } from './SpotlightHintRow.js';
import { buildClientContextActions } from './SpotlightActionMenu.js';
import type {
  SpotlightActionResult,
  SpotlightSearchResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type UseSpotlightKeyboardOptions = {
  query: string;
  selectedItem: SpotlightSearchResult | null;
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
  selectedFocusPane: 'list' | 'graph';
  setSelectedFocusPane: (pane: 'list' | 'graph') => void;
  setQuery: (q: string) => void;
  close: () => void;
  exitDrilldown: () => void;
  handleActivate: (item: SpotlightSearchResult) => Promise<void>;
  handleApplyHint: (hint: string) => void;
  handleConfirmDestructive: () => Promise<void>;
  setConfirmingAction: (action: SpotlightSearchResult | null) => void;
};

type UseSpotlightKeyboardReturn = {
  handleKeyDownCapture: (event: React.KeyboardEvent) => void;
};

export function useSpotlightKeyboard(
  options: UseSpotlightKeyboardOptions,
): UseSpotlightKeyboardReturn {
  const {
    query,
    selectedItem,
    hoveredGraphItem,
    activeTreeId,
    hintCandidates,
    activeHint,
    actionMenuActions,
    setActionMenuActions,
    confirmingAction,
    quickLookItem,
    setQuickLookItem,
    helpOpen,
    setHelpOpen,
    drilldownScope,
    selectedFocusPane,
    setSelectedFocusPane,
    setQuery,
    close,
    exitDrilldown,
    handleActivate,
    handleApplyHint,
    handleConfirmDestructive,
    setConfirmingAction,
  } = options;

  const handleKeyDownCapture = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter': {
        if (confirmingAction) {
          event.preventDefault();
          event.stopPropagation();
          void handleConfirmDestructive();
          return;
        }
        if (hoveredGraphItem) {
          event.preventDefault();
          event.stopPropagation();
          void handleActivate(hoveredGraphItem);
          return;
        }
        return;
      }
      case 'Tab':
        if (shouldApplyHintOnTab(query, hintCandidates) && activeHint) {
          event.preventDefault();
          event.stopPropagation();
          handleApplyHint(activeHint);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setSelectedFocusPane(selectedFocusPane === 'list' ? 'graph' : 'list');
        return;
      case 'Backspace': {
        if (drilldownScope && query === '') {
          event.preventDefault();
          event.stopPropagation();
          exitDrilldown();
          return;
        }
        const isMac = navigator.platform.includes('Mac');
        const clearCombo = isMac ? event.metaKey : event.ctrlKey;
        if (clearCombo) {
          event.preventDefault();
          event.stopPropagation();
          setQuery('');
        }
        return;
      }
      case '?':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          setHelpOpen(!helpOpen);
        }
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (confirmingAction) {
          setConfirmingAction(null);
        } else if (quickLookItem) {
          setQuickLookItem(null);
        } else if (actionMenuActions) {
          setActionMenuActions(null);
        } else if (helpOpen) {
          setHelpOpen(false);
        } else if (drilldownScope) {
          exitDrilldown();
        } else {
          close();
        }
        return;
      case 'k': {
        const isMac = navigator.platform.includes('Mac');
        if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();
          if (actionMenuActions) {
            setActionMenuActions(null);
            return;
          }
          if (!selectedItem) return;
          const actions = buildClientContextActions(selectedItem, activeTreeId);
          setActionMenuActions(actions.length > 0 ? actions : null);
        }
        return;
      }
      case 'l': {
        const isMacL = navigator.platform.includes('Mac');
        if ((isMacL && event.metaKey) || (!isMacL && event.ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();
          if (quickLookItem) {
            setQuickLookItem(null);
            return;
          }
          if (selectedItem && (selectedItem.kind === 'node' || selectedItem.kind === 'tree')) {
            setQuickLookItem(selectedItem);
          }
        }
        return;
      }
      default:
        return;
    }
  }, [
    actionMenuActions,
    activeHint,
    activeTreeId,
    close,
    confirmingAction,
    drilldownScope,
    exitDrilldown,
    handleActivate,
    handleApplyHint,
    handleConfirmDestructive,
    helpOpen,
    hintCandidates,
    hoveredGraphItem,
    query,
    quickLookItem,
    selectedFocusPane,
    selectedItem,
    setActionMenuActions,
    setConfirmingAction,
    setHelpOpen,
    setQuery,
    setQuickLookItem,
    setSelectedFocusPane,
  ]);

  return { handleKeyDownCapture };
}
