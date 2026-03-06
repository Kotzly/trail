import { useEffect, useRef, useCallback } from 'react';
import { runtimeGetURL } from '@shared/platform/webext.js';
import type { NodeId, Url } from '@shared/types/ids.js';
import type { SpotlightGraphPreviewData } from './types.js';

type SpotlightGraphFrameProps = {
  activeTreeId: string | null;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: NodeId | null;
  highlightNodeId: NodeId | null;
  selectionIntentId: number;
  onNavigate: (treeId: string, nodeId: NodeId, url: Url) => void;
  onHoverNode: (treeId: string, nodeId: NodeId | null) => void;
};

type GraphContextMessage = {
  type: 'SET_GRAPH_CONTEXT';
  activeTreeId: string;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: NodeId | null;
  highlightNodeId: NodeId | null;
  selectionIntentId: number;
};

function isNavigateMessage(msg: unknown): msg is { type: 'NAVIGATE'; treeId: string; nodeId: number; url: string } {
  if (typeof msg !== 'object' || msg === null) return false;
  if ((msg as Record<string, unknown>).type !== 'NAVIGATE') return false;
  const nodeId = (msg as Record<string, unknown>).nodeId;
  const treeId = (msg as Record<string, unknown>).treeId;
  const url = (msg as Record<string, unknown>).url;
  return (
    typeof treeId === 'string' &&
    typeof nodeId === 'number' &&
    Number.isFinite(nodeId) &&
    typeof url === 'string'
  );
}

function isGraphReadyMessage(msg: unknown): msg is { type: 'GRAPH_READY' } {
  return (
    typeof msg === 'object'
    && msg !== null
    && (msg as Record<string, unknown>).type === 'GRAPH_READY'
  );
}

function isHoverNodeMessage(msg: unknown): msg is { type: 'HOVER_NODE'; treeId: string; nodeId: number | null } {
  if (typeof msg !== 'object' || msg === null) return false;
  if ((msg as Record<string, unknown>).type !== 'HOVER_NODE') return false;
  const treeId = (msg as Record<string, unknown>).treeId;
  const nodeId = (msg as Record<string, unknown>).nodeId;
  return (
    typeof treeId === 'string'
    && (nodeId === null || (typeof nodeId === 'number' && Number.isFinite(nodeId)))
  );
}

export function SpotlightGraphFrame({
  activeTreeId,
  previewData,
  selectedNodeId,
  highlightNodeId,
  selectionIntentId,
  onNavigate,
  onHoverNode,
}: SpotlightGraphFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingContextRef = useRef<GraphContextMessage | null>(null);

  const sendContext = useCallback((context: GraphContextMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(context, '*');
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (isGraphReadyMessage(event.data)) {
        readyRef.current = true;
        if (pendingContextRef.current) {
          sendContext(pendingContextRef.current);
        }
        return;
      }

      if (isNavigateMessage(event.data)) {
        onNavigate(event.data.treeId, event.data.nodeId as NodeId, event.data.url as Url);
        return;
      }

      if (isHoverNodeMessage(event.data)) {
        onHoverNode(
          event.data.treeId,
          event.data.nodeId === null ? null : (event.data.nodeId as NodeId),
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onHoverNode, onNavigate, sendContext]);

  useEffect(() => {
    if (!activeTreeId) return;
    const nextContext: GraphContextMessage = {
      type: 'SET_GRAPH_CONTEXT',
      activeTreeId,
      previewData,
      selectedNodeId,
      highlightNodeId,
      selectionIntentId,
    };
    pendingContextRef.current = nextContext;
    if (readyRef.current) {
      sendContext(nextContext);
    }
  }, [activeTreeId, highlightNodeId, previewData, selectedNodeId, selectionIntentId, sendContext]);

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
