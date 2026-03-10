import { useCallback, useRef, useState } from 'react';
import {
  executeSpotlightAction,
  exportTree,
  getSpotlightTreePreview,
} from './rpc.js';
import { LRUMap } from './lru-map.js';
import type {
  SpotlightActionId,
  SpotlightActionResult,
  SpotlightGraphPreviewData,
  SpotlightSearchResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers (module-level, only used by handleActivate for export-tree)
// ---------------------------------------------------------------------------

function downloadBundle(bundle: import('@shared/types/export.js').TrailExportBundle): void {
  const label = bundle.source.treeLabel ?? 'trail';
  const json = JSON.stringify(bundle);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFilename(label)}.trail.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'trail';
}

function resolveCopyUrlItem(
  action: Extract<SpotlightSearchResult, { kind: 'action' }>,
  items: SpotlightSearchResult[],
): Extract<SpotlightSearchResult, { kind: 'node' }> | null {
  const target = action.target;
  if (!target || target.kind !== 'node') return null;
  const item = items.find((candidate) => {
    return (
      candidate.kind === 'node'
      && candidate.nodeId === target.nodeId
      && candidate.treeId === target.treeId
    );
  });
  return item?.kind === 'node' ? item : null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type DrilldownScope = { treeId: string; treeName: string };

type UseSpotlightActionsOptions = {
  activeTreeId: string | null;
  query: string;
  close: () => void;
  flatItems: SpotlightSearchResult[];
  previewCache: LRUMap<string, SpotlightGraphPreviewData>;
  setGraphPreviewData: (data: SpotlightGraphPreviewData | null) => void;
  setGraphPreviewLoading: (loading: boolean) => void;
  setQuery: (q: string) => void;
  setHelpOpen: (open: boolean) => void;
  drilldownScope: DrilldownScope | null;
  setDrilldownScope: (scope: DrilldownScope | null) => void;
};

type UseSpotlightActionsReturn = {
  actionMenuActions: SpotlightActionResult[] | null;
  setActionMenuActions: (actions: SpotlightActionResult[] | null) => void;
  confirmingAction: SpotlightSearchResult | null;
  setConfirmingAction: (action: SpotlightSearchResult | null) => void;
  quickLookItem: SpotlightSearchResult | null;
  setQuickLookItem: (item: SpotlightSearchResult | null) => void;
  drilldownTransition: 'idle' | 'entering' | 'exiting';
  predrilldownQuery: string;
  collapsedSections: Set<string>;
  statusText: string | null;
  setStatusText: (text: string | null) => void;
  handleActivate: (item: SpotlightSearchResult) => Promise<void>;
  handleInlineAction: (
    actionId: SpotlightActionId,
    target: Parameters<typeof executeSpotlightAction>[1],
    statusText: string,
  ) => Promise<void>;
  handleActionMenuSelect: (action: SpotlightActionResult) => void;
  handleConfirmDestructive: () => Promise<void>;
  exitDrilldown: () => void;
  toggleSection: (sectionId: string) => void;
  handleExecuteAction: (
    actionId: SpotlightActionId,
    target: Parameters<typeof executeSpotlightAction>[1],
    statusText: string,
  ) => Promise<void>;
};

export function useSpotlightActions(
  options: UseSpotlightActionsOptions,
): UseSpotlightActionsReturn {
  const {
    activeTreeId,
    query,
    close,
    flatItems,
    previewCache,
    setGraphPreviewData,
    setGraphPreviewLoading,
    setQuery,
    setHelpOpen,
    drilldownScope,
    setDrilldownScope,
  } = options;

  const [actionMenuActions, setActionMenuActions] = useState<SpotlightActionResult[] | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<SpotlightSearchResult | null>(null);
  const [quickLookItem, setQuickLookItem] = useState<SpotlightSearchResult | null>(null);
  const [predrilldownQuery, setPredrilldownQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [drilldownTransition, setDrilldownTransition] = useState<'idle' | 'entering' | 'exiting'>('idle');
  const [statusText, setStatusText] = useState<string | null>(null);

  const drilldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExecuteAction = useCallback(
    async (
      actionId: SpotlightActionId,
      target: Parameters<typeof executeSpotlightAction>[1],
      nextStatusText: string,
    ) => {
      try {
        const response = await executeSpotlightAction(actionId, target, query);
        if (response.statusText) {
          setStatusText(response.statusText);
        } else {
          setStatusText(nextStatusText);
        }
        if (response.closeSpotlight) close();
      } catch (error) {
        console.error(`Failed to execute spotlight action ${actionId}:`, error);
        setStatusText('Action failed');
      }
    },
    [close, query],
  );

  const handleInlineAction = useCallback(
    async (
      actionId: SpotlightActionId,
      target: Parameters<typeof executeSpotlightAction>[1],
      nextStatusText: string,
    ) => {
      try {
        const response = await executeSpotlightAction(actionId, target, query);
        setStatusText(response.statusText ?? nextStatusText);
      } catch (error) {
        console.error(`Failed to execute inline action ${actionId}:`, error);
        setStatusText('Action failed');
      }
    },
    [query],
  );

  const exitDrilldown = useCallback(() => {
    if (drilldownTimerRef.current) clearTimeout(drilldownTimerRef.current);
    setDrilldownTransition('exiting');
    const restored = predrilldownQuery;
    drilldownTimerRef.current = setTimeout(() => {
      setDrilldownScope(null);
      setPredrilldownQuery('');
      setQuery(restored);
      setGraphPreviewData(null);
      setDrilldownTransition('idle');
    }, 220);
  }, [predrilldownQuery, setQuery, setGraphPreviewData, setDrilldownScope]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleActivate = useCallback(async (item: SpotlightSearchResult) => {
    setStatusText(null);
    setConfirmingAction(null);

    if (item.kind === 'action') {
      if (item.actionId === 'show-command-help') {
        setHelpOpen(true);
        return;
      }
      if (item.safety === 'destructive') {
        setConfirmingAction(item);
        return;
      }
      if (item.actionId === 'copy-url') {
        const targetItem = resolveCopyUrlItem(item, flatItems);
        if (targetItem) {
          try {
            await navigator.clipboard.writeText(targetItem.url);
            setStatusText('URL copied');
            close();
          } catch (error) {
            console.error('Failed to copy URL:', error);
            setStatusText('Clipboard unavailable');
          }
        }
        return;
      }
      if (item.actionId === 'export-tree') {
        try {
          const treeId = item.target?.kind === 'tree' ? item.target.treeId : undefined;
          const bundle = await exportTree(treeId);
          downloadBundle(bundle);
          setStatusText('Tree exported');
          close();
        } catch (error) {
          console.error('Failed to export tree:', error);
          setStatusText('Export failed');
        }
        return;
      }

      await handleExecuteAction(item.actionId, item.target, 'Done');
      return;
    }

    if (item.kind === 'tree') {
      if (drilldownTimerRef.current) clearTimeout(drilldownTimerRef.current);
      setDrilldownTransition('entering');
      setPredrilldownQuery(query);
      setDrilldownScope({ treeId: item.treeId, treeName: item.treeName });
      setQuery('');
      drilldownTimerRef.current = setTimeout(() => setDrilldownTransition('idle'), 250);

      const cached = previewCache.get(item.treeId);
      if (cached) {
        setGraphPreviewData(cached);
      } else {
        setGraphPreviewLoading(true);
        void getSpotlightTreePreview(item.treeId).then((preview) => {
          if (preview) {
            previewCache.set(item.treeId, preview);
            setGraphPreviewData(preview);
          }
          setGraphPreviewLoading(false);
        });
      }
      return;
    }

    const actionId: SpotlightActionId =
      activeTreeId && item.treeId !== activeTreeId ? 'open-node-in-tree' : 'open';
    await handleExecuteAction(
      actionId,
      { kind: 'node', nodeId: item.nodeId, treeId: item.treeId },
      actionId === 'open-node-in-tree' ? 'Opened in tree' : 'Opened',
    );
  }, [activeTreeId, close, flatItems, handleExecuteAction, previewCache, query, setDrilldownScope, setGraphPreviewData, setGraphPreviewLoading, setHelpOpen, setQuery]);

  const handleActionMenuSelect = useCallback(
    (action: SpotlightActionResult) => {
      setActionMenuActions(null);
      void handleActivate(action);
    },
    [handleActivate],
  );

  const handleConfirmDestructive = useCallback(async () => {
    if (!confirmingAction || confirmingAction.kind !== 'action') return;
    const action = confirmingAction;
    setConfirmingAction(null);
    await handleExecuteAction(action.actionId, action.target, 'Done');
  }, [confirmingAction, handleExecuteAction]);

  return {
    actionMenuActions,
    setActionMenuActions,
    confirmingAction,
    setConfirmingAction,
    quickLookItem,
    setQuickLookItem,
    drilldownTransition,
    predrilldownQuery,
    collapsedSections,
    statusText,
    setStatusText,
    handleActivate,
    handleInlineAction,
    handleActionMenuSelect,
    handleConfirmDestructive,
    exitDrilldown,
    toggleSection,
    handleExecuteAction,
  };
}
