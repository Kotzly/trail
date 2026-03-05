import { browser } from 'wxt/browser';
import type {
  LegacySpotlightBootstrapData,
  LegacySpotlightSearchResponse,
  LegacySpotlightSearchSessionId,
} from './legacy-types.js';
import type { NodeId, Url } from '@shared/types/ids.js';

const RPC_VERSION = 2 as const;

let rpcCounter = 0;
function createRpcId(): string {
  rpcCounter += 1;
  return `spotlight-legacy-${rpcCounter}-${Date.now()}`;
}

type RpcEnvelope = {
  v: typeof RPC_VERSION;
  kind: 'rpc-request';
  id: string;
  method: string;
  input: Record<string, unknown>;
};

function buildEnvelope(method: string, input: Record<string, unknown> = {}): RpcEnvelope {
  return {
    v: RPC_VERSION,
    kind: 'rpc-request',
    id: createRpcId(),
    method,
    input,
  };
}

type RpcResponseEnvelope = {
  success: boolean;
  data?: unknown;
  error?: string;
};

async function sendRpc<T>(method: string, input: Record<string, unknown> = {}): Promise<T> {
  const envelope = buildEnvelope(method, input);
  const response = (await browser.runtime.sendMessage(envelope)) as RpcResponseEnvelope;
  if (!response?.success) {
    throw new Error(response?.error ?? `RPC ${method} failed`);
  }
  return response.data as T;
}

export async function bootstrapLegacySpotlight(limit = 80): Promise<LegacySpotlightBootstrapData> {
  return sendRpc<LegacySpotlightBootstrapData>('SPOTLIGHT_BOOTSTRAP', { limit });
}

export async function searchLegacySpotlight(
  sessionId: LegacySpotlightSearchSessionId,
  query: string,
  limit: number,
  requestSeq: number,
): Promise<LegacySpotlightSearchResponse> {
  return sendRpc<LegacySpotlightSearchResponse>('SPOTLIGHT_SEARCH', {
    sessionId,
    query,
    limit,
    requestSeq,
  });
}

export async function disposeLegacySpotlightSession(sessionId: LegacySpotlightSearchSessionId): Promise<void> {
  await sendRpc<void>('SPOTLIGHT_DISPOSE_SESSION', { sessionId });
}

export async function navigateLegacySpotlightNode(nodeId: NodeId, url: Url): Promise<void> {
  await sendRpc<void>('NAVIGATE_TO', { nodeId, url });
}

export async function openLegacySpotlightTree(treeId: string): Promise<void> {
  await sendRpc<void>('OPEN_TREE', { treeId });
}
