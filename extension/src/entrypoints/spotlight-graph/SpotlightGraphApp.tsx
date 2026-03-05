import { useEffect, useCallback, useRef } from 'react';
import GraphArea from '@entrypoints/sidepanel/ui/components/graph/GraphArea.js';
import { useBootstrap } from '@entrypoints/sidepanel/ui/hooks/useBootstrap.js';
import { useRuntimeMessages } from '@entrypoints/sidepanel/ui/hooks/useRuntimeMessages.js';
import { listenSystemTheme } from '@entrypoints/sidepanel/ui/hooks/listenSystemTheme.js';
import { useStore } from '@entrypoints/sidepanel/ui/state/store.js';
import type { NodeId } from '@shared/types/ids.js';

type SetHighlightMessage = {
  type: 'SET_HIGHLIGHT';
  highlightNodeId: number | null;
};

function isSetHighlightMessage(msg: unknown): msg is SetHighlightMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  if ((msg as Record<string, unknown>).type !== 'SET_HIGHLIGHT') return false;
  const highlightNodeId = (msg as Record<string, unknown>).highlightNodeId;
  return (
    highlightNodeId === null ||
    (typeof highlightNodeId === 'number' && Number.isFinite(highlightNodeId))
  );
}

export default function SpotlightGraphApp() {
  useBootstrap();
  useRuntimeMessages();
  listenSystemTheme();

  const hoverNodeId = useStore((state) => state.graph.hoverNodeId);
  const clearSearch = useStore((state) => state.clearSearch);
  const readyFired = useRef(false);
  const focusIntentRef = useRef(0);
  const lastHoverSentRef = useRef<NodeId | null | undefined>(undefined);

  // Ensure spotlight never carries graph search dim state from previous sessions.
  useEffect(() => {
    clearSearch();
  }, [clearSearch]);

  // Listen for highlight messages from parent content script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isSetHighlightMessage(event.data)) return;

      const { highlightNodeId } = event.data;
      if (highlightNodeId !== null && Number.isInteger(highlightNodeId) && highlightNodeId > 0) {
        focusIntentRef.current += 1;
        useStore.setState((state) => ({
          graph: {
            ...state.graph,
            viewIntent: {
              focusNodeId: highlightNodeId as NodeId,
              mode: 'soft',
              intentId: focusIntentRef.current,
            },
          },
        }));
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal the parent that we're ready
    if (!readyFired.current) {
      readyFired.current = true;
      window.parent.postMessage({ type: 'GRAPH_READY' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (lastHoverSentRef.current === hoverNodeId) return;
    lastHoverSentRef.current = hoverNodeId;
    window.parent.postMessage({ type: 'HOVER_NODE', nodeId: hoverNodeId }, '*');
  }, [hoverNodeId]);

  const handleNodeActivate = useCallback((nodeId: NodeId, url: string) => {
    window.parent.postMessage({ type: 'NAVIGATE', nodeId, url }, '*');
  }, []);

  return (
    <div className="container" style={{ width: '100%', height: '100%' }}>
      <GraphArea onNodeActivate={handleNodeActivate} showControls={false} />
    </div>
  );
}
