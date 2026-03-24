import type { NodeId } from "@shared/types/ids.js";
import type { SpotlightGraphPreviewData } from "./types.js";

function getExtensionOrigin(): string {
  try {
    if (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime?.getURL) {
      return new URL(globalThis.chrome.runtime.getURL("")).origin;
    }
  } catch {
    /* ignore */
  }
  return "*";
}

const EXTENSION_ORIGIN = getExtensionOrigin();

// ---------------------------------------------------------------------------
// Message types — discriminated union for all iframe boundary messages
// ---------------------------------------------------------------------------

// Parent -> Graph iframe
type SetGraphContextMsg = {
  type: "SET_GRAPH_CONTEXT";
  activeTreeId: string;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: NodeId | null;
  highlightNodeId: NodeId | null;
  selectionIntentId: number;
  searchMatchNodeIds?: NodeId[];
};

// Graph iframe -> Parent (no URLs — sensitive data stays in the receiver's context)
type GraphReadyMsg = { type: "GRAPH_READY" };
type NavigateMsg = { type: "NAVIGATE"; treeId: string; nodeId: NodeId };
type HoverNodeMsg = { type: "HOVER_NODE"; treeId: string; nodeId: NodeId | null };
type EscapeKeyMsg = { type: "ESCAPE_KEY" };

// Internal handshake message for establishing a private MessageChannel
type PortOfferMsg = { type: "__SPOTLIGHT_PORT_OFFER__" };

export type ParentToGraphMsg = SetGraphContextMsg;
export type GraphToParentMsg = GraphReadyMsg | NavigateMsg | HoverNodeMsg | EscapeKeyMsg;
export type SpotlightIPCMessage = ParentToGraphMsg | GraphToParentMsg;

// ---------------------------------------------------------------------------
// Single type guard — consumers never write their own
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set<string>([
  "SET_GRAPH_CONTEXT",
  "GRAPH_READY",
  "NAVIGATE",
  "HOVER_NODE",
  "ESCAPE_KEY",
]);

function isSpotlightIPC(data: unknown): data is SpotlightIPCMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).type === "string" &&
    KNOWN_TYPES.has((data as Record<string, unknown>).type as string)
  );
}

function isPortOffer(data: unknown): data is PortOfferMsg {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "__SPOTLIGHT_PORT_OFFER__"
  );
}

// ---------------------------------------------------------------------------
// MessageChannel management — private channel between parent and graph iframe
//
// The content script (parent) creates a MessageChannel and transfers one port
// to the graph iframe via postMessage. Once both sides hold a port, all
// subsequent graph-to-parent messages flow through the channel instead of
// window.postMessage, so host page scripts cannot eavesdrop.
// ---------------------------------------------------------------------------

/** Port received by the graph iframe for sending messages back to the parent. */
let iframePort: MessagePort | null = null;

// ---------------------------------------------------------------------------
// Typed send helpers
// ---------------------------------------------------------------------------

/**
 * Parent (content script) -> Graph iframe.
 * Uses postMessage with the extension origin as targetOrigin.
 */
export function sendToGraph(iframe: HTMLIFrameElement, msg: ParentToGraphMsg): void {
  iframe.contentWindow?.postMessage(msg, EXTENSION_ORIGIN);
}

/**
 * Graph iframe -> Parent (content script).
 * Prefers the private MessagePort when available; falls back to postMessage
 * with targetOrigin="*" only for the initial GRAPH_READY before the channel
 * is established. No sensitive data (URLs, tokens) is ever included in
 * fallback messages.
 */
export function sendToParent(msg: GraphToParentMsg): void {
  if (iframePort) {
    iframePort.postMessage(msg);
  } else {
    // Fallback before MessageChannel is established.
    // Only GRAPH_READY and ESCAPE_KEY should reach here — neither contains
    // sensitive data. NAVIGATE and HOVER_NODE carry only opaque IDs.
    window.parent.postMessage(msg, "*");
  }
}

/**
 * Establish a private MessageChannel with the graph iframe.
 * Called by the parent (content script) after the iframe element is available.
 * Transfers port2 to the iframe; the parent keeps port1 for receiving.
 * Returns a cleanup function.
 */
export function establishChannel(
  iframe: HTMLIFrameElement,
  handler: (msg: GraphToParentMsg) => void,
): () => void {
  const channel = new MessageChannel();

  channel.port1.onmessage = (event: MessageEvent) => {
    if (!isSpotlightIPC(event.data)) return;
    if (event.data.type === "SET_GRAPH_CONTEXT") return;
    handler(event.data as GraphToParentMsg);
  };
  channel.port1.start();

  // Send port2 to the iframe so it can reply privately
  iframe.contentWindow?.postMessage(
    { type: "__SPOTLIGHT_PORT_OFFER__" } satisfies PortOfferMsg,
    EXTENSION_ORIGIN,
    [channel.port2],
  );

  return () => {
    channel.port1.onmessage = null;
    channel.port1.close();
  };
}

// ---------------------------------------------------------------------------
// Typed subscribe helpers — return cleanup functions
// ---------------------------------------------------------------------------

/**
 * Listen for graph-to-parent messages via window.postMessage.
 * Used as a fallback before the MessageChannel is established (e.g. GRAPH_READY).
 */
export function onGraphMessage(
  source: Window | null,
  handler: (msg: GraphToParentMsg) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== source) return;
    if (!isSpotlightIPC(event.data)) return;
    // Only pass graph-to-parent messages
    if (event.data.type === "SET_GRAPH_CONTEXT") return;
    handler(event.data as GraphToParentMsg);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/**
 * Listen for parent-to-graph messages and port offers inside the graph iframe.
 * When a __SPOTLIGHT_PORT_OFFER__ arrives, the transferred port is stored so
 * subsequent sendToParent() calls use the private channel.
 */
export function onParentMessage(handler: (msg: ParentToGraphMsg) => void): () => void {
  const listener = (event: MessageEvent) => {
    // Accept the private MessagePort when offered by the parent
    if (isPortOffer(event.data) && event.ports.length > 0) {
      iframePort = event.ports[0] ?? null;
      iframePort?.start();
      return;
    }

    // Note: cannot check event.origin here — the sender is a content script
    // running in the web page's browsing context, so event.origin is the
    // page's origin (e.g. https://google.com), not the extension origin.
    // Security is handled by the type-discriminant guard + the iframe being
    // an extension page that only the extension can embed.
    if (!isSpotlightIPC(event.data)) return;
    // Only pass parent-to-graph messages
    if (event.data.type !== "SET_GRAPH_CONTEXT") return;
    handler(event.data as ParentToGraphMsg);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
