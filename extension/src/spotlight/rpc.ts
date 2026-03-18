import { browser } from 'wxt/browser';
import type {
  SpotlightActionId,
  SpotlightActionTarget,
  SpotlightBatchActionId,
  SpotlightBootstrapData,
  SpotlightExecuteActionResponse,
  SpotlightGraphPreviewData,
  SpotlightSearchResponse,
  SpotlightSearchSessionId,
} from './types.js';
import type { NodeId, Url } from '@shared/types/ids.js';
import type { ResolvedFlags } from '@shared/types/flags.js';
import type { TrailExportBundle } from '@shared/types/export.js';
import type { Settings } from '@shared/types/settings.js';

const RPC_VERSION = 2 as const;

let rpcCounter = 0;
function createRpcId(): string {
  rpcCounter += 1;
  return `spotlight-${rpcCounter}-${Date.now()}`;
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

export async function bootstrapSpotlight(limit = 80): Promise<SpotlightBootstrapData> {
  return sendRpc<SpotlightBootstrapData>('SPOTLIGHT_BOOTSTRAP', { limit });
}

export async function searchSpotlight(
  sessionId: SpotlightSearchSessionId,
  query: string,
  limit: number,
  requestSeq: number,
  scopeTreeId?: string,
): Promise<SpotlightSearchResponse> {
  return sendRpc<SpotlightSearchResponse>('SPOTLIGHT_SEARCH', {
    sessionId,
    query,
    limit,
    requestSeq,
    ...(scopeTreeId ? { scopeTreeId } : {}),
  });
}

export async function disposeSpotlightSession(sessionId: SpotlightSearchSessionId): Promise<void> {
  await sendRpc<void>('SPOTLIGHT_DISPOSE_SESSION', { sessionId });
}

export async function getSpotlightTreePreview(treeId: string): Promise<SpotlightGraphPreviewData | null> {
  return sendRpc<SpotlightGraphPreviewData | null>('SPOTLIGHT_GET_TREE_PREVIEW', { treeId });
}

export async function navigateToNode(nodeId: NodeId, url: Url): Promise<void> {
  await sendRpc<void>('NAVIGATE_TO', { nodeId, url });
}

export async function openTree(treeId: string): Promise<void> {
  await sendRpc<void>('OPEN_TREE', { treeId });
}

export async function executeSpotlightAction(
  actionId: SpotlightActionId,
  target?: SpotlightActionTarget,
  query?: string,
): Promise<SpotlightExecuteActionResponse> {
  const input: Record<string, unknown> = { actionId };
  if (target) input.target = target;
  if (query !== undefined) input.query = query;
  return sendRpc<SpotlightExecuteActionResponse>('SPOTLIGHT_EXECUTE_ACTION', input);
}

export async function executeBatchAction(
  actionId: SpotlightBatchActionId,
  targets: SpotlightActionTarget[],
): Promise<SpotlightExecuteActionResponse> {
  return sendRpc<SpotlightExecuteActionResponse>('SPOTLIGHT_EXECUTE_BATCH_ACTION', {
    actionId,
    targets,
  });
}

export async function getSpotlightThumbnail(
  nodeId: NodeId,
  treeId: string,
): Promise<{ dataUrl: string } | null> {
  return sendRpc<{ dataUrl: string } | null>('SPOTLIGHT_GET_THUMBNAIL', { nodeId, treeId });
}

export async function getSettings(): Promise<Settings> {
  return sendRpc<Settings>('GET_SETTINGS');
}

export async function getFlags(): Promise<ResolvedFlags> {
  return sendRpc<ResolvedFlags>('GET_FLAGS');
}

export async function exportTree(treeId?: string): Promise<TrailExportBundle> {
  const input: Record<string, unknown> = {};
  if (treeId) input.treeId = treeId;
  return sendRpc<TrailExportBundle>('EXPORT_TREE', input);
}
