/**
 * Fetch a single trail's tree payload from the cloud API.
 * Used to rehydrate stubs (archive entries without local blobs).
 */

import { buildBackendUrl, initBackendConfig, BACKEND_CONFIG } from '../../shared/config/backend.js';
import { isNavigationTreeJSON } from './cloud-sync.js';
import type { NavigationTreeJSON } from '../../shared/types/tree.js';

const AUTH_STORAGE_KEY = 'trail_auth_session' as const;

async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const raw = result[AUTH_STORAGE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const token = (raw as { accessToken?: string }).accessToken;
  return typeof token === 'string' && token ? token : null;
}

/**
 * Fetch a trail's NavigationTreeJSON from the backend.
 * Returns null if not found, unauthorized, or on error.
 */
export async function fetchTrailFromCloud(treeId: string): Promise<NavigationTreeJSON | null> {
  try {
    await initBackendConfig();
    const token = await getAccessToken();
    if (!token) {
      console.warn(`cloudFetch: No access token to fetch trail ${treeId}`);
      return null;
    }

    const url = buildBackendUrl(`/trails/${treeId}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (error) {
      console.warn(`cloudFetch: Network error fetching trail ${treeId}:`, error);
      return null;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.warn(`cloudFetch: Failed to fetch trail ${treeId}: ${response.status}`);
      return null;
    }

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return null;

    const payload = (data as { payload?: unknown }).payload;
    if (!isNavigationTreeJSON(payload)) {
      console.warn(`cloudFetch: Invalid payload for trail ${treeId}`);
      return null;
    }

    return payload;
  } catch (error) {
    console.error(`cloudFetch: Unexpected error fetching trail ${treeId}:`, error);
    return null;
  }
}
