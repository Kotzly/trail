import { useEffect, useRef, useCallback, useState } from 'react';
import { runtimeGetURL } from '@shared/platform/webext.js';
import type { NodeId, Url } from '@shared/types/ids.js';
import type { SpotlightGraphPreviewData } from './types.js';
import { sendToGraph, onGraphMessage } from './spotlight-ipc.js';
import type { ParentToGraphMsg } from './spotlight-ipc.js';

type SpotlightGraphFrameProps = {
  activeTreeId: string | null;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: NodeId | null;
  highlightNodeId: NodeId | null;
  selectionIntentId: number;
  searchMatchNodeIds?: NodeId[] | undefined;
  onNavigate: (treeId: string, nodeId: NodeId, url: Url) => void;
  onHoverNode: (treeId: string, nodeId: NodeId | null) => void;
  onEscapeKey?: () => void;
};

export function SpotlightGraphFrame({
  activeTreeId,
  previewData,
  selectedNodeId,
  highlightNodeId,
  selectionIntentId,
  searchMatchNodeIds,
  onNavigate,
  onHoverNode,
  onEscapeKey,
}: SpotlightGraphFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingContextRef = useRef<ParentToGraphMsg | null>(null);
  const [graphReady, setGraphReady] = useState(false);

  const sendContext = useCallback((context: ParentToGraphMsg) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    sendToGraph(iframe, context);
  }, []);

  useEffect(() => {
    const source = iframeRef.current?.contentWindow ?? null;
    return onGraphMessage(source, (msg) => {
      switch (msg.type) {
        case 'GRAPH_READY':
          readyRef.current = true;
          setGraphReady(true);
          if (pendingContextRef.current) {
            sendContext(pendingContextRef.current);
          }
          break;
        case 'NAVIGATE':
          onNavigate(msg.treeId, msg.nodeId, msg.url);
          break;
        case 'HOVER_NODE':
          onHoverNode(msg.treeId, msg.nodeId);
          break;
        case 'ESCAPE_KEY':
          onEscapeKey?.();
          break;
      }
    });
  }, [onHoverNode, onNavigate, onEscapeKey, sendContext]);

  useEffect(() => {
    if (!activeTreeId) return;
    const nextContext: ParentToGraphMsg = {
      type: 'SET_GRAPH_CONTEXT',
      activeTreeId,
      previewData,
      selectedNodeId,
      highlightNodeId,
      selectionIntentId,
      ...(searchMatchNodeIds && { searchMatchNodeIds }),
    };
    pendingContextRef.current = nextContext;
    if (readyRef.current) {
      sendContext(nextContext);
    }
  }, [activeTreeId, highlightNodeId, previewData, searchMatchNodeIds, selectedNodeId, selectionIntentId, sendContext]);

  const src = runtimeGetURL('spotlight-graph.html');

  return (
    <>
      <iframe
        ref={iframeRef}
        src={src}
        className="spotlight-graph-container"
        style={{
          border: 'none',
          background: 'transparent',
          width: '100%',
          height: '100%',
          opacity: graphReady ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        allow="autoplay"
      />
      {!graphReady && <div className="spotlight-graph-shimmer" />}
    </>
  );
}
