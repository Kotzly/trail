import { useEffect, useCallback, useRef } from 'react';
import GraphArea from '@entrypoints/sidepanel/ui/components/graph/GraphArea.js';
import { useBootstrap } from '@entrypoints/sidepanel/ui/hooks/useBootstrap.js';
import { useRuntimeMessages } from '@entrypoints/sidepanel/ui/hooks/useRuntimeMessages.js';
import { listenSystemTheme } from '@entrypoints/sidepanel/ui/hooks/listenSystemTheme.js';
import { useStore } from '@entrypoints/sidepanel/ui/state/store.js';
import type { NodeId } from '@shared/types/ids.js';

type SetHighlightMessage = {
  type: 'SET_HIGHLIGHT';
  highlightNodeId: string | null;
};

function isSetHighlightMessage(msg: unknown): msg is SetHighlightMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'SET_HIGHLIGHT'
  );
}

export default function SpotlightGraphApp() {
  useBootstrap();
  useRuntimeMessages();
  listenSystemTheme();

  const setSearchResults = useStore((state) => state.setSearchResults);
  const setSearchIndex = useStore((state) => state.setSearchIndex);
  const clearSearch = useStore((state) => state.clearSearch);
  const readyFired = useRef(false);

  // Listen for highlight messages from parent content script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isSetHighlightMessage(event.data)) return;

      const { highlightNodeId } = event.data;
      if (highlightNodeId) {
        // Set as search result so GraphCanvas highlights + centers on it
        setSearchResults([highlightNodeId as NodeId], 0);
        // Increment navStep so GraphCanvas centers on the node
        setSearchIndex(0);
      } else {
        clearSearch();
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal the parent that we're ready
    if (!readyFired.current) {
      readyFired.current = true;
      window.parent.postMessage({ type: 'GRAPH_READY' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [setSearchResults, setSearchIndex, clearSearch]);

  const handleNodeActivate = useCallback((nodeId: NodeId, url: string) => {
    window.parent.postMessage({ type: 'NAVIGATE', nodeId, url }, '*');
  }, []);

  return (
    <div className="container" style={{ width: '100%', height: '100%' }}>
      <GraphArea onNodeActivate={handleNodeActivate} />
    </div>
  );
}
