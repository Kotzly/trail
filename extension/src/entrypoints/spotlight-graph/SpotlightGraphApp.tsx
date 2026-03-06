import { useEffect, useCallback, useRef } from 'react';
import GraphArea from '@entrypoints/sidepanel/ui/components/graph/GraphArea.js';
import { useBootstrap } from '@entrypoints/sidepanel/ui/hooks/useBootstrap.js';
import { listenSystemTheme } from '@entrypoints/sidepanel/ui/hooks/listenSystemTheme.js';
import { useStore } from '@entrypoints/sidepanel/ui/state/store.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import type { SpotlightGraphPreviewData } from '../../spotlight/types.js';
import type { NodeId } from '@shared/types/ids.js';

type SetGraphContextMessage = {
  type: 'SET_GRAPH_CONTEXT';
  activeTreeId: string;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: number | null;
  highlightNodeId: number | null;
  selectionIntentId: number;
};

function isSetGraphContextMessage(msg: unknown): msg is SetGraphContextMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  if ((msg as Record<string, unknown>).type !== 'SET_GRAPH_CONTEXT') return false;
  const activeTreeId = (msg as Record<string, unknown>).activeTreeId;
  const selectionIntentId = (msg as Record<string, unknown>).selectionIntentId;
  return typeof activeTreeId === 'string' && typeof selectionIntentId === 'number';
}

function isValidNodeId(value: unknown): value is NodeId | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

export default function SpotlightGraphApp() {
  useBootstrap();
  listenSystemTheme();

  const tree = useStore((state) => state.tree);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const openNodeIds = useStore((state) => state.openNodeIds);
  const tabStates = useStore((state) => state.tabStates);
  const nodeTabCounts = useStore((state) => state.nodeTabCounts);
  const nodeRecency = useStore((state) => state.nodeRecency);
  const hoverNodeId = useStore((state) => state.graph.hoverNodeId);
  const clearSearch = useStore((state) => state.clearSearch);

  const activePreviewRef = useRef<SpotlightGraphPreviewData | null>(null);
  const activeTreeIdRef = useRef<string | null>(null);
  const currentPreviewTreeIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef<NodeId | null>(null);
  const externalHighlightNodeIdRef = useRef<NodeId | null>(null);
  const lastSelectionIntentRef = useRef(0);
  const readyFired = useRef(false);
  const suppressHoverEchoRef = useRef(false);
  const lastHoverSentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    clearSearch();
  }, [clearSearch]);

  useEffect(() => {
    if (!tree || activePreviewRef.current) return;
    activePreviewRef.current = {
      treeId: activeTreeIdRef.current ?? '__active__',
      treeName: '',
      tree: NavigationTreeMapper.toJSON(tree),
      currentNodeId,
      openNodeIds: Array.from(openNodeIds),
      tabStates,
      nodeTabCounts,
      nodeRecency,
    };
    if (currentPreviewTreeIdRef.current === null) {
      currentPreviewTreeIdRef.current = activePreviewRef.current.treeId;
    }
    if (!readyFired.current) {
      readyFired.current = true;
      window.parent.postMessage({ type: 'GRAPH_READY' }, '*');
    }
  }, [currentNodeId, nodeRecency, nodeTabCounts, openNodeIds, tabStates, tree]);

  const applyPreviewData = useCallback((preview: SpotlightGraphPreviewData) => {
    useStore.getState().applyTreeState({
      tree: preview.tree,
      openNodeIds: preview.openNodeIds,
      tabStates: preview.tabStates,
      nodeTabCounts: preview.nodeTabCounts,
      nodeRecency: preview.nodeRecency,
      reason: 'tree-switch',
    });
  }, []);

  const setLocalHighlight = useCallback((nodeId: NodeId | null) => {
    suppressHoverEchoRef.current = true;
    useStore.getState().setHoverNodeId(nodeId);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isSetGraphContextMessage(event.data)) return;
      const {
        activeTreeId,
        previewData,
        selectedNodeId,
        highlightNodeId,
        selectionIntentId,
      } = event.data;
      if (!isValidNodeId(selectedNodeId) || !isValidNodeId(highlightNodeId)) return;

      activeTreeIdRef.current = activeTreeId;
      if (activePreviewRef.current?.treeId === '__active__') {
        activePreviewRef.current = {
          ...activePreviewRef.current,
          treeId: activeTreeId,
        };
        if (currentPreviewTreeIdRef.current === '__active__') {
          currentPreviewTreeIdRef.current = activeTreeId;
        }
      }
      const nextPreview = previewData ?? activePreviewRef.current;
      if (!nextPreview) {
        return;
      }

      const previewChanged = currentPreviewTreeIdRef.current !== nextPreview.treeId;
      if (previewChanged) {
        currentPreviewTreeIdRef.current = nextPreview.treeId;
        applyPreviewData(nextPreview);
      }

      selectedNodeIdRef.current = selectedNodeId;
      const nextHighlightNodeId = highlightNodeId ?? selectedNodeId;
      externalHighlightNodeIdRef.current = nextHighlightNodeId;

      if (previewChanged || hoverNodeId !== nextHighlightNodeId) {
        setLocalHighlight(nextHighlightNodeId);
      }

      if (
        selectionIntentId !== 0
        && selectionIntentId !== lastSelectionIntentRef.current
        && selectedNodeId !== null
      ) {
        lastSelectionIntentRef.current = selectionIntentId;
        useStore.setState((state) => ({
          graph: {
            ...state.graph,
            viewIntent: {
              focusNodeId: selectedNodeId,
              mode: 'soft',
              intentId: selectionIntentId,
            },
          },
        }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [applyPreviewData, hoverNodeId, setLocalHighlight]);

  useEffect(() => {
    if (!readyFired.current) return;
    const previewTreeId = currentPreviewTreeIdRef.current ?? activeTreeIdRef.current;
    if (!previewTreeId) return;

    if (suppressHoverEchoRef.current) {
      suppressHoverEchoRef.current = false;
      return;
    }

    const baselineHighlight = externalHighlightNodeIdRef.current;
    if (hoverNodeId === null) {
      const payloadKey = `${previewTreeId}:null`;
      if (lastHoverSentRef.current !== payloadKey) {
        lastHoverSentRef.current = payloadKey;
        window.parent.postMessage({ type: 'HOVER_NODE', treeId: previewTreeId, nodeId: null }, '*');
      }
      if (baselineHighlight !== null) {
        setLocalHighlight(baselineHighlight);
      }
      return;
    }

    if (hoverNodeId === baselineHighlight) {
      const payloadKey = `${previewTreeId}:null`;
      if (lastHoverSentRef.current !== payloadKey) {
        lastHoverSentRef.current = payloadKey;
        window.parent.postMessage({ type: 'HOVER_NODE', treeId: previewTreeId, nodeId: null }, '*');
      }
      return;
    }

    const payloadKey = `${previewTreeId}:${hoverNodeId}`;
    if (lastHoverSentRef.current === payloadKey) return;
    lastHoverSentRef.current = payloadKey;
    window.parent.postMessage({ type: 'HOVER_NODE', treeId: previewTreeId, nodeId: hoverNodeId }, '*');
  }, [hoverNodeId, setLocalHighlight]);

  const handleNodeActivate = useCallback((nodeId: NodeId, url: string) => {
    const previewTreeId = currentPreviewTreeIdRef.current ?? activeTreeIdRef.current;
    if (!previewTreeId) return;
    window.parent.postMessage({ type: 'NAVIGATE', treeId: previewTreeId, nodeId, url }, '*');
  }, []);

  return (
    <div className="container" style={{ width: '100%', height: '100%' }}>
      <GraphArea onNodeActivate={handleNodeActivate} showControls={false} />
    </div>
  );
}
