import type { NodeId, Url } from '@shared/types/ids.js';
import type { SpotlightGraphPreviewData } from './types.js';

function getExtensionOrigin(): string {
  try {
    if (typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime?.getURL) {
      return new URL(globalThis.chrome.runtime.getURL('')).origin;
    }
  } catch { /* ignore */ }
  return '*';
}

const EXTENSION_ORIGIN = getExtensionOrigin();

// ---------------------------------------------------------------------------
// Message types — discriminated union for all iframe boundary messages
// ---------------------------------------------------------------------------

// Parent -> Graph iframe
type SetGraphContextMsg = {
  type: 'SET_GRAPH_CONTEXT';
  activeTreeId: string;
  previewData: SpotlightGraphPreviewData | null;
  selectedNodeId: NodeId | null;
  highlightNodeId: NodeId | null;
  selectionIntentId: number;
  searchMatchNodeIds?: NodeId[];
};

// Graph iframe -> Parent
type GraphReadyMsg = { type: 'GRAPH_READY' };
type NavigateMsg = { type: 'NAVIGATE'; treeId: string; nodeId: NodeId; url: Url };
type HoverNodeMsg = { type: 'HOVER_NODE'; treeId: string; nodeId: NodeId | null };
type EscapeKeyMsg = { type: 'ESCAPE_KEY' };

export type ParentToGraphMsg = SetGraphContextMsg;
export type GraphToParentMsg = GraphReadyMsg | NavigateMsg | HoverNodeMsg | EscapeKeyMsg;
export type SpotlightIPCMessage = ParentToGraphMsg | GraphToParentMsg;

// ---------------------------------------------------------------------------
// Single type guard — consumers never write their own
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set<string>([
  'SET_GRAPH_CONTEXT',
  'GRAPH_READY',
  'NAVIGATE',
  'HOVER_NODE',
  'ESCAPE_KEY',
]);

function isSpotlightIPC(data: unknown): data is SpotlightIPCMessage {
  return (
    typeof data === 'object'
    && data !== null
    && typeof (data as Record<string, unknown>).type === 'string'
    && KNOWN_TYPES.has((data as Record<string, unknown>).type as string)
  );
}

// ---------------------------------------------------------------------------
// Typed send helpers
// ---------------------------------------------------------------------------

export function sendToGraph(iframe: HTMLIFrameElement, msg: ParentToGraphMsg): void {
  iframe.contentWindow?.postMessage(msg, EXTENSION_ORIGIN);
}

export function sendToParent(msg: GraphToParentMsg): void {
  // Parent is an arbitrary web page — must use '*' as targetOrigin.
  // Security: onGraphMessage validates event.source instead.
  window.parent.postMessage(msg, '*');
}

// ---------------------------------------------------------------------------
// Typed subscribe helpers — return cleanup functions
// ---------------------------------------------------------------------------

export function onGraphMessage(
  source: Window | null,
  handler: (msg: GraphToParentMsg) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== source) return;
    if (!isSpotlightIPC(event.data)) return;
    // Only pass graph-to-parent messages
    if (event.data.type === 'SET_GRAPH_CONTEXT') return;
    handler(event.data as GraphToParentMsg);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function onParentMessage(
  handler: (msg: ParentToGraphMsg) => void,
): () => void {
  const listener = (event: MessageEvent) => {
    // Note: cannot check event.origin here — the sender is a content script
    // running in the web page's browsing context, so event.origin is the
    // page's origin (e.g. https://google.com), not the extension origin.
    // Security is handled by the type-discriminant guard + the iframe being
    // an extension page that only the extension can embed.
    if (!isSpotlightIPC(event.data)) return;
    // Only pass parent-to-graph messages
    if (event.data.type !== 'SET_GRAPH_CONTEXT') return;
    handler(event.data as ParentToGraphMsg);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
