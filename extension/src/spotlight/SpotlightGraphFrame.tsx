import { useEffect, useRef, useCallback } from 'react';
import { runtimeGetURL } from '@shared/platform/webext.js';
import type { NodeId, Url } from '@shared/types/ids.js';

type SpotlightGraphFrameProps = {
  highlightNodeId: NodeId | null;
  onNavigate: (nodeId: NodeId, url: Url) => void;
  onHoverNode: (nodeId: NodeId | null) => void;
};

function isNavigateMessage(msg: unknown): msg is { type: 'NAVIGATE'; nodeId: number; url: string } {
  if (typeof msg !== 'object' || msg === null) return false;
  if ((msg as Record<string, unknown>).type !== 'NAVIGATE') return false;
  const nodeId = (msg as Record<string, unknown>).nodeId;
  const url = (msg as Record<string, unknown>).url;
  return (
    typeof nodeId === 'number' &&
    Number.isFinite(nodeId) &&
    typeof url === 'string'
  );
}

function isGraphReadyMessage(msg: unknown): msg is { type: 'GRAPH_READY' } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'GRAPH_READY'
  );
}

function isHoverNodeMessage(msg: unknown): msg is { type: 'HOVER_NODE'; nodeId: number | null } {
  if (typeof msg !== 'object' || msg === null) return false;
  if ((msg as Record<string, unknown>).type !== 'HOVER_NODE') return false;
  const nodeId = (msg as Record<string, unknown>).nodeId;
  return nodeId === null || (typeof nodeId === 'number' && Number.isFinite(nodeId));
}

export function SpotlightGraphFrame({ highlightNodeId, onNavigate, onHoverNode }: SpotlightGraphFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingHighlightRef = useRef<NodeId | null>(null);

  const sendHighlight = useCallback((nodeId: NodeId | null) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'SET_HIGHLIGHT', highlightNodeId: nodeId }, '*');
  }, []);

  // Listen for GRAPH_READY and NAVIGATE from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (isGraphReadyMessage(event.data)) {
        readyRef.current = true;
        // Replay pending highlight
        if (pendingHighlightRef.current !== null) {
          sendHighlight(pendingHighlightRef.current);
          pendingHighlightRef.current = null;
        }
        return;
      }

      if (isNavigateMessage(event.data)) {
        onNavigate(event.data.nodeId as NodeId, event.data.url as Url);
        return;
      }

      if (isHoverNodeMessage(event.data)) {
        const nodeId = event.data.nodeId;
        onHoverNode(nodeId === null ? null : (nodeId as NodeId));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onHoverNode, onNavigate, sendHighlight]);

  // Send highlight changes to iframe
  useEffect(() => {
    if (readyRef.current) {
      sendHighlight(highlightNodeId);
    } else {
      pendingHighlightRef.current = highlightNodeId;
    }
  }, [highlightNodeId, sendHighlight]);

  const src = runtimeGetURL('spotlight-graph.html');

  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="spotlight-graph-container"
      style={{
        border: 'none',
        width: '100%',
        height: '100%',
        background: 'transparent',
      }}
      allow="autoplay"
    />
  );
}
