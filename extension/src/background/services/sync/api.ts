/**
 * Typed HTTP client for all tree sync API endpoints.
 *
 * Endpoints:
 *   POST   /trails/sync    – index sync (metadata-only)
 *   PUT    /trails/:id     – upsert single tree
 *   GET    /trails/:id     – fetch single tree
 *   DELETE /trails/:id     – soft-delete tree
 *   PATCH  /trails/:id     – editor partial update
 */

import { buildBackendUrl, BACKEND_CONFIG, initBackendConfig } from '../../../shared/config/backend.js';
import type { NavigationTreeJSON, TreeLabelSource } from '../../../shared/types/tree.js';

/* ------------------------------------------------------------------ */
/*  Response types                                                     */
/* ------------------------------------------------------------------ */

export type IndexSyncMeta = {
  id: string;
  deviceId: string;
  label: string;
  labelSource: TreeLabelSource;
  labelUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  savedAt: string;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
  deletedAt: string | null;
};

export type IndexSyncResponse = {
  serverSyncAt: string;
  updates: IndexSyncMeta[];
};

export type PushTreeResponse = {
  updatedAt: string;
  applied: boolean;
};

export type PullTreeResponse = {
  id: string;
  deviceId: string;
  label: string;
  labelSource: TreeLabelSource;
  labelUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  savedAt: string;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
  payload: NavigationTreeJSON;
  deletedAt: string | null;
};

export type PatchTreeResponse = {
  id: string;
  updatedAt: string;
};

export type DeleteTreeResponse = {
  id: string;
  deletedAt: string;
};

/* ------------------------------------------------------------------ */
/*  Error types                                                        */
/* ------------------------------------------------------------------ */

export type ApiErrorKind =
  | 'unauthorized'
  | 'feature_locked'
  | 'not_found'
  | 'network'
  | 'timeout'
  | 'server_error'
  | 'invalid_response';

export class SyncApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'SyncApiError';
  }

  get retryable(): boolean {
    return this.kind === 'server_error' || this.kind === 'network' || this.kind === 'timeout';
  }
}

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

const AUTH_STORAGE_KEY = 'trail_auth_session' as const;

async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const raw = result[AUTH_STORAGE_KEY] as { accessToken?: string } | undefined;
  if (!raw || typeof raw !== 'object') return null;
  return typeof raw.accessToken === 'string' && raw.accessToken ? raw.accessToken : null;
}

/* ------------------------------------------------------------------ */
/*  Request helper                                                     */
/* ------------------------------------------------------------------ */

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  await initBackendConfig();
  const token = await getAccessToken();
  if (!token) {
    throw new SyncApiError('unauthorized', 401, 'No auth token');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildBackendUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SyncApiError('timeout', null, 'Request timed out');
    }
    throw new SyncApiError('network', null, error instanceof Error ? error.message : 'Network error');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SyncApiError('unauthorized', response.status, 'Unauthorized');
    }
    if (response.status === 402) {
      throw new SyncApiError('feature_locked', 402, 'Feature locked');
    }
    if (response.status === 404) {
      throw new SyncApiError('not_found', 404, 'Not found');
    }
    throw new SyncApiError('server_error', response.status, `HTTP ${response.status}`);
  }

  const json = await response.json().catch(() => null);
  if (!json) {
    throw new SyncApiError('invalid_response', response.status, 'Invalid JSON response');
  }

  return json as T;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export const syncApi = {
  /**
   * Index sync: sends deviceId + clientSyncAt, receives metadata-only updates.
   */
  async syncIndex(deviceId: string, clientSyncAt: string): Promise<IndexSyncResponse> {
    return apiRequest<IndexSyncResponse>('POST', '/trails/sync', {
      deviceId,
      clientSyncAt,
    });
  },

  /**
   * Push (upsert) a single tree to the server.
   */
  async pushTree(params: {
    id: string;
    deviceId: string;
    label: string;
    labelSource: TreeLabelSource;
    labelUpdatedAt: string;
    createdAt: string;
    updatedAt: string;
    savedAt: string;
    nodeCount: number;
    rootUrl: string | null;
    rootTitle: string | null;
    rootFavicon: string | null;
    payload: NavigationTreeJSON;
    deletedAt: string | null;
  }): Promise<PushTreeResponse> {
    const { id, ...body } = params;
    return apiRequest<PushTreeResponse>('PUT', `/trails/${id}`, body);
  },

  /**
   * Pull a single tree from the server (full payload).
   */
  async pullTree(treeId: string): Promise<PullTreeResponse> {
    return apiRequest<PullTreeResponse>('GET', `/trails/${treeId}`);
  },

  /**
   * Soft-delete a tree on the server.
   */
  async deleteTree(treeId: string): Promise<DeleteTreeResponse> {
    return apiRequest<DeleteTreeResponse>('DELETE', `/trails/${treeId}`);
  },

  /**
   * Partial update (editor real-time save).
   */
  async patchTree(treeId: string, data: {
    payload: NavigationTreeJSON;
    nodeCount: number;
    rootUrl: string | null;
    rootTitle: string | null;
    rootFavicon: string | null;
    savedAt: string;
  }): Promise<PatchTreeResponse> {
    return apiRequest<PatchTreeResponse>('PATCH', `/trails/${treeId}`, data);
  },
};
