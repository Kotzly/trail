import { useEffect, useRef, useCallback } from 'react';
import { browser } from 'wxt/browser';
import type { NodeId, Url } from '@shared/types/ids.js';

type SpotlightGraphFrameProps = {
  highlightNodeId: NodeId | null;
  onNavigate: (nodeId: NodeId, url: Url) => void;
};

function isNavigateMessage(msg: unknown): msg is { type: 'NAVIGATE'; nodeId: string; url: string } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'NAVIGATE' &&
    typeof (msg as Record<string, unknown>).nodeId === 'string'
  );
}

function isGraphReadyMessage(msg: unknown): msg is { type: 'GRAPH_READY' } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'GRAPH_READY'
  );
}

export function SpotlightGraphFrame({ highlightNodeId, onNavigate }: SpotlightGraphFrameProps) {
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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNavigate, sendHighlight]);

  // Send highlight changes to iframe
  useEffect(() => {
    if (readyRef.current) {
      sendHighlight(highlightNodeId);
    } else {
      pendingHighlightRef.current = highlightNodeId;
    }
  }, [highlightNodeId, sendHighlight]);

  // Prevent page scroll when wheeling over the iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    iframe.addEventListener('wheel', onWheel, { passive: false });
    return () => iframe.removeEventListener('wheel', onWheel);
  }, []);

  const src = browser.runtime.getURL('/spotlight-graph.html');

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
