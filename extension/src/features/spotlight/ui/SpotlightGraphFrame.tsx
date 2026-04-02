import { useEffect, useRef, useCallback, useState } from "react";
import { runtimeGetURL } from "@shared/platform/webext.js";
import type { NodeId } from "@shared/types/ids.js";
import type { SpotlightGraphPreviewData } from "./types.js";
import {
  sendToGraph,
  onGraphMessage,
  establishChannel,
  type ParentToGraphMsg,
  type GraphToParentMsg,
} from "./spotlight-ipc.js";

type SpotlightGraphFrameProps = {
  activeTreeId: string | null;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: NodeId | null;
  highlightNodeId: NodeId | null;
  selectionIntentId: number;
  searchMatchNodeIds?: NodeId[] | undefined;
  /** Show full tree (fitToView) instead of compact zoomed-in view. Default: true (compact). */
  compactInitialView?: boolean;
  onNavigate: (treeId: string, nodeId: NodeId) => void;
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
  compactInitialView = true,
  onNavigate,
  onHoverNode,
  onEscapeKey,
}: SpotlightGraphFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingContextRef = useRef<ParentToGraphMsg | null>(null);
  const channelCleanupRef = useRef<(() => void) | null>(null);
  const [graphReady, setGraphReady] = useState(false);
  const handleGraphMsgRef = useRef<((msg: GraphToParentMsg) => void) | null>(null);

  const sendContext = useCallback((context: ParentToGraphMsg) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    sendToGraph(iframe, context);
  }, []);

  // Handle graph-to-parent messages (shared handler for both postMessage and
  // MessageChannel paths).
  const handleGraphMsg = useCallback(
    (msg: GraphToParentMsg) => {
      switch (msg.type) {
        case "GRAPH_READY": {
          readyRef.current = true;
          setGraphReady(true);
          // Establish private MessageChannel now that the iframe is ready
          const iframe = iframeRef.current;
          if (iframe) {
            channelCleanupRef.current?.();
            channelCleanupRef.current = establishChannel(iframe, (m) => handleGraphMsgRef.current?.(m));
          }
          if (pendingContextRef.current) {
            sendContext(pendingContextRef.current);
          }
          break;
        }
        case "NAVIGATE":
          onNavigate(msg.treeId, msg.nodeId);
          break;
        case "HOVER_NODE":
          onHoverNode(msg.treeId, msg.nodeId);
          break;
        case "ESCAPE_KEY":
          onEscapeKey?.();
          break;
      }
    },
    [onHoverNode, onNavigate, onEscapeKey, sendContext],
  );
  // eslint-disable-next-line react-hooks/refs -- sync ref to break circular self-reference in useCallback
  handleGraphMsgRef.current = handleGraphMsg;

  // Listen for initial messages via window.postMessage (before channel is up)
  useEffect(() => {
    const source = iframeRef.current?.contentWindow ?? null;
    return onGraphMessage(source, handleGraphMsg);
  }, [handleGraphMsg]);

  // Clean up MessageChannel on unmount
  useEffect(() => {
    return () => {
      channelCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!activeTreeId) return;
    const nextContext: ParentToGraphMsg = {
      type: "SET_GRAPH_CONTEXT",
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
  }, [
    activeTreeId,
    highlightNodeId,
    previewData,
    searchMatchNodeIds,
    selectedNodeId,
    selectionIntentId,
    sendContext,
  ]);

  let src = runtimeGetURL("spotlight-graph.html");
  if (!compactInitialView) src += "?compact=0";

  return (
    <>
      <iframe
        ref={iframeRef}
        src={src}
        className="spotlight-graph-container"
        style={{
          border: "none",
          background: "transparent",
          width: "100%",
          height: "100%",
          opacity: graphReady ? 1 : 0,
          transition: "opacity 0.1s ease",
        }}
        allow="autoplay"
      />
      {!graphReady && <div className="spotlight-graph-shimmer" />}
    </>
  );
}
