import { buildBackendUrl, BACKEND_CONFIG, initBackendConfig } from '../../shared/config/backend.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { uuidv7 } from '../../shared/lib/uuid.js';
import type { NavigationTreeJSON, TreeLabelSource, TreeMeta, TreeRecord, TreeSummary } from '../../shared/types/tree.js';
import type { FaviconUrl, Title, Url } from '../../shared/types/ids.js';
import { notifyTreesUpdate } from '../messaging/notifications.js';
import { treeStorage } from './tree-storage.js';
import { findBestTrailFavicon } from '../../shared/lib/tree-favicon.js';

const AUTH_STORAGE_KEY = 'trail_auth_session' as const;
const SYNC_DEVICE_ID_KEY = 'trail_sync_device_id' as const;
const SYNC_SERVER_AT_KEY = 'trail_sync_server_at' as const;
const SYNC_TOMBSTONES_KEY = 'trail_sync_tombstones' as const;
const TREE_STORAGE_KEYS = new Set(['trail_tree', 'trail_tree_meta', 'trail_tree_archives']);
const SYNC_ALARM_NAME = 'trail-cloud-sync' as const;
const SYNC_DEBOUNCE_MS = 2000;
const SYNC_ALARM_MINUTES = 5;
const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type StoredAuthSession = {
  accessToken?: string;
};

type ApiTrailRecord = {
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

type ApiSyncResponse = {
  serverSyncAt: string;
  updates: ApiTrailRecord[];
};

type TombstoneRecord = {
  id: string;
  label: string;
  labelSource: TreeLabelSource;
  labelUpdatedAt: number;
  createdAt: number;
  savedAt: number;
  nodeCount: number;
  rootUrl: Url | undefined;
  rootTitle: Title | undefined;
  rootFavicon: FaviconUrl | undefined;
  tree: NavigationTreeJSON;
  deletedAt: number;
};

type ParsedRemoteTrail = {
  id: string;
  deviceId: string;
  label: string;
  labelSource: TreeLabelSource;
  labelUpdatedAt: number;
  createdAt: number;
  updatedAt: number;
  savedAt: number;
  nodeCount: number;
  rootUrl: Url | null;
  rootTitle: Title | null;
  rootFavicon: FaviconUrl | null;
  payload: NavigationTreeJSON;
  deletedAt: number | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function normalizeLabelSource(value: unknown): TreeLabelSource {
  if (value === 'user' || value === 'auto' || value === 'system') return value;
  return 'system';
}

export function isNavigationTreeJSON(value: unknown): value is NavigationTreeJSON {
  if (!isObject(value)) return false;
  if (!('root' in value)) return false;
  const currentNodeId = value.currentNodeId;
  const nodeCount = value.nodeCount;
  // currentNodeId is NodeId (branded number) or null, not string
  if (!(currentNodeId === null || typeof currentNodeId === 'number')) return false;
  if (!Number.isFinite(nodeCount)) return false;
  return true;
}

function getRecordUpdatedAt(record: {
  savedAt: number;
  labelUpdatedAt: number;
  createdAt: number;
  deletedAt?: number | null;
}): number {
  return Math.max(record.savedAt, record.labelUpdatedAt, record.createdAt, record.deletedAt ?? 0);
}

function toArchiveSummary(record: TreeRecord): TreeSummary {
  const summary: TreeSummary = {
    id: record.id,
    label: record.label,
    labelSource: record.labelSource,
    labelUpdatedAt: record.labelUpdatedAt,
    createdAt: record.createdAt,
    nodeCount: record.nodeCount,
    savedAt: record.savedAt,
  };
  if (record.rootUrl) summary.rootUrl = record.rootUrl;
  if (record.rootTitle) summary.rootTitle = record.rootTitle;
  if (record.rootFavicon) summary.rootFavicon = record.rootFavicon;
  return summary;
}

export function toTreeRecordFromRemote(remote: ParsedRemoteTrail): TreeRecord {
  const record: TreeRecord = {
    id: remote.id,
    label: remote.label,
    labelSource: remote.labelSource,
    labelUpdatedAt: remote.labelUpdatedAt,
    createdAt: remote.createdAt,
    nodeCount: remote.nodeCount,
    savedAt: remote.savedAt,
    tree: remote.payload,
  };
  if (remote.rootUrl) {
    record.rootUrl = remote.rootUrl;
  }
  if (remote.rootTitle) {
    record.rootTitle = remote.rootTitle;
  }
  if (remote.rootFavicon) {
    record.rootFavicon = remote.rootFavicon;
  }
  return record;
}

export function parseRemoteTrail(value: unknown): ParsedRemoteTrail | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const deviceId = typeof value.deviceId === 'string' ? value.deviceId : '';
  const label = typeof value.label === 'string' ? value.label : '';
  const labelUpdatedAt = parseTimestamp(value.labelUpdatedAt);
  const createdAt = parseTimestamp(value.createdAt);
  const updatedAt = parseTimestamp(value.updatedAt);
  const savedAt = parseTimestamp(value.savedAt);
  const deletedAt = value.deletedAt === null ? null : parseTimestamp(value.deletedAt);
  const nodeCount = typeof value.nodeCount === 'number' ? value.nodeCount : null;
  const payload = value.payload;

  if (
    !id ||
    !deviceId ||
    !label ||
    labelUpdatedAt === null ||
    createdAt === null ||
    updatedAt === null ||
    savedAt === null ||
    nodeCount === null ||
    !isNavigationTreeJSON(payload)
  ) {
    return null;
  }

  return {
    id,
    deviceId,
    label,
    labelSource: normalizeLabelSource(value.labelSource),
    labelUpdatedAt,
    createdAt,
    updatedAt,
    savedAt,
    nodeCount,
    rootUrl: typeof value.rootUrl === 'string' ? (value.rootUrl as Url) : null,
    rootTitle: typeof value.rootTitle === 'string' ? (value.rootTitle as Title) : null,
    rootFavicon: typeof value.rootFavicon === 'string' ? (value.rootFavicon as FaviconUrl) : null,
    payload,
    deletedAt,
  };
}

function parseStoredTombstones(value: unknown): TombstoneRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): TombstoneRecord | null => {
      if (!isObject(entry)) return null;
      const id = typeof entry.id === 'string' ? entry.id : '';
      const label = typeof entry.label === 'string' ? entry.label : '';
      const labelUpdatedAt = typeof entry.labelUpdatedAt === 'number' ? entry.labelUpdatedAt : null;
      const createdAt = typeof entry.createdAt === 'number' ? entry.createdAt : null;
      const savedAt = typeof entry.savedAt === 'number' ? entry.savedAt : null;
      const deletedAt = typeof entry.deletedAt === 'number' ? entry.deletedAt : null;
      const nodeCount = typeof entry.nodeCount === 'number' ? entry.nodeCount : null;
      const tree = entry.tree;
      if (
        !id ||
        !label ||
        labelUpdatedAt === null ||
        createdAt === null ||
        savedAt === null ||
        deletedAt === null ||
        nodeCount === null ||
        !isNavigationTreeJSON(tree)
      ) {
        return null;
      }
      return {
        id,
        label,
        labelSource: normalizeLabelSource(entry.labelSource),
        labelUpdatedAt,
        createdAt,
        savedAt,
        deletedAt,
        nodeCount,
        rootUrl: typeof entry.rootUrl === 'string' ? (entry.rootUrl as Url) : undefined,
        rootTitle: typeof entry.rootTitle === 'string' ? (entry.rootTitle as Title) : undefined,
        rootFavicon: typeof entry.rootFavicon === 'string' ? (entry.rootFavicon as FaviconUrl) : undefined,
        tree,
      };
    })
    .filter((entry): entry is TombstoneRecord => Boolean(entry));
}

function tombstoneToApiRecord(
  tombstone: TombstoneRecord,
  deviceId: string,
): ApiTrailRecord {
  const updatedAt = getRecordUpdatedAt({
    savedAt: tombstone.savedAt,
    labelUpdatedAt: tombstone.labelUpdatedAt,
    createdAt: tombstone.createdAt,
    deletedAt: tombstone.deletedAt,
  });
  return {
    id: tombstone.id,
    deviceId,
    label: tombstone.label,
    labelSource: tombstone.labelSource,
    labelUpdatedAt: toIso(tombstone.labelUpdatedAt),
    createdAt: toIso(tombstone.createdAt),
    updatedAt: toIso(updatedAt),
    savedAt: toIso(tombstone.savedAt),
    nodeCount: tombstone.nodeCount,
    rootUrl: tombstone.rootUrl ?? null,
    rootTitle: tombstone.rootTitle ?? null,
    rootFavicon: tombstone.rootFavicon ?? null,
    payload: tombstone.tree,
    deletedAt: toIso(tombstone.deletedAt),
  };
}

function archiveToApiRecord(record: TreeRecord, deviceId: string): ApiTrailRecord {
  const updatedAt = getRecordUpdatedAt(record);
  return {
    id: record.id,
    deviceId,
    label: record.label,
    labelSource: record.labelSource,
    labelUpdatedAt: toIso(record.labelUpdatedAt),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(updatedAt),
    savedAt: toIso(record.savedAt),
    nodeCount: record.nodeCount,
    rootUrl: record.rootUrl ?? null,
    rootTitle: record.rootTitle ?? null,
    rootFavicon: record.rootFavicon ?? null,
    payload: record.tree,
    deletedAt: null,
  };
}

class CloudSyncService {
  private initialized = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private applyingRemote = false;
  private localMutationAt = 0;
  private mutatedDuringSync = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      this.handleStorageChanges(changes, areaName);
    });
    chrome.alarms?.onAlarm.addListener((alarm) => {
      if (alarm.name !== SYNC_ALARM_NAME) return;
      void this.syncNow('alarm');
    });
    chrome.alarms?.create(SYNC_ALARM_NAME, { periodInMinutes: SYNC_ALARM_MINUTES });
    this.scheduleSync(1000);
  }

  scheduleSync(delayMs: number = SYNC_DEBOUNCE_MS): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow('scheduled');
    }, delayMs);
  }

  async recordArchiveDeletion(record: TreeRecord): Promise<void> {
    const now = Date.now();
    const current = await this.getTombstones();
    const next = [
      ...current.filter((entry) => entry.id !== record.id),
      {
        id: record.id,
        label: record.label,
        labelSource: record.labelSource,
        labelUpdatedAt: record.labelUpdatedAt,
        createdAt: record.createdAt,
        savedAt: record.savedAt,
        nodeCount: record.nodeCount,
        rootUrl: record.rootUrl,
        rootTitle: record.rootTitle,
        rootFavicon: record.rootFavicon,
        tree: record.tree,
        deletedAt: now,
      },
    ];
    await this.setTombstones(next);
    this.scheduleSync(500);
  }

  async syncNow(_trigger: 'manual' | 'scheduled' | 'alarm' = 'manual'): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.performSync().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async performSync(): Promise<void> {
    await initBackendConfig();
    const token = await this.getAccessToken();
    if (!token) return;

    const deviceId = await this.getOrCreateDeviceId();
    const clientSyncAt = await this.getClientSyncAt();
    const payload = await this.buildPayload(deviceId);
    if (payload.length === 0) return;

    this.mutatedDuringSync = false;
    const startedAt = this.localMutationAt;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);

    let response: Response;
    try {
      response = await fetch(buildBackendUrl(BACKEND_CONFIG.endpoints.trailsSync), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          clientSyncAt,
          trails: payload,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      this.scheduleSync(5000);
      return;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 402) {
        const payload = await response.json().catch(() => null) as { code?: unknown } | null;
        if (payload?.code === 'feature_locked') {
          return;
        }
      }
      if (response.status !== 401 && response.status !== 403) {
        this.scheduleSync(5000);
      }
      return;
    }

    const body = (await response.json().catch(() => null)) as ApiSyncResponse | null;
    if (!body || typeof body.serverSyncAt !== 'string' || !Array.isArray(body.updates)) {
      return;
    }

    if (this.mutatedDuringSync || this.localMutationAt > startedAt) {
      this.scheduleSync(1000);
      return;
    }

    await this.applyRemoteUpdates(body.updates);
    await this.setClientSyncAt(body.serverSyncAt);
    await this.pruneAcknowledgedTombstones(body.serverSyncAt);
  }

  private handleStorageChanges(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void {
    if (areaName !== 'local') return;

    if (AUTH_STORAGE_KEY in changes) {
      const nextToken = this.getTokenFromValue(changes[AUTH_STORAGE_KEY]?.newValue);
      if (nextToken) {
        this.scheduleSync(500);
      }
    }

    if (this.applyingRemote) return;
    const treeChanged = Object.keys(changes).some((key) => TREE_STORAGE_KEYS.has(key));
    if (!treeChanged) return;

    this.localMutationAt = Date.now();
    if (this.inFlight) {
      this.mutatedDuringSync = true;
    }
    this.scheduleSync();
  }

  private async buildPayload(deviceId: string): Promise<ApiTrailRecord[]> {
    const [activeMeta, tree, activeSavedAt, archives, storedTombstones] = await Promise.all([
      treeStorage.getActiveMeta(),
      treeStorage.getOrCreateTree(),
      treeStorage.getActiveSavedAt(),
      treeStorage.getArchives(),
      this.getTombstones(),
    ]);

    const root = tree.getRoot();
    const activeRecord: ApiTrailRecord = {
      id: activeMeta.id,
      deviceId,
      label: activeMeta.label,
      labelSource: activeMeta.labelSource,
      labelUpdatedAt: toIso(activeMeta.labelUpdatedAt),
      createdAt: toIso(activeMeta.createdAt),
      updatedAt: toIso(
        getRecordUpdatedAt({
          savedAt: activeSavedAt,
          labelUpdatedAt: activeMeta.labelUpdatedAt,
          createdAt: activeMeta.createdAt,
        }),
      ),
      savedAt: toIso(activeSavedAt),
      nodeCount: tree.size(),
      rootUrl: root?.data.url ?? null,
      rootTitle: root?.data.title ?? null,
      rootFavicon: (() => {
        const treeJSON = NavigationTreeMapper.toJSON(tree);
        return findBestTrailFavicon(treeJSON) ?? root?.data.favicon ?? null;
      })(),
      payload: NavigationTreeMapper.toJSON(tree),
      deletedAt: null,
    };

    const records = new Map<string, ApiTrailRecord>();
    records.set(activeRecord.id, activeRecord);

    for (const archive of archives) {
      const item = archiveToApiRecord(archive, deviceId);
      const prev = records.get(item.id);
      if (!prev || Date.parse(prev.updatedAt) < Date.parse(item.updatedAt)) {
        records.set(item.id, item);
      }
    }

    const now = Date.now();
    const liveUpdatedAt = new Map<string, number>();
    for (const [id, item] of records) {
      liveUpdatedAt.set(id, Date.parse(item.updatedAt));
    }

    const tombstones = storedTombstones.filter((entry) => now - entry.deletedAt < TOMBSTONE_RETENTION_MS);
    let tombstonesChanged = tombstones.length !== storedTombstones.length;
    for (const tombstone of tombstones) {
      const item = tombstoneToApiRecord(tombstone, deviceId);
      const prevLiveUpdatedAt = liveUpdatedAt.get(item.id);
      const itemUpdatedAt = Date.parse(item.updatedAt);
      if (prevLiveUpdatedAt !== undefined && prevLiveUpdatedAt >= itemUpdatedAt) {
        tombstonesChanged = true;
        continue;
      }
      const prev = records.get(item.id);
      if (!prev || Date.parse(prev.updatedAt) < itemUpdatedAt) {
        records.set(item.id, item);
      }
    }

    if (tombstonesChanged) {
      const existingIds = new Set(records.keys());
      const nextTombstones = tombstones.filter((entry) => {
        const live = records.get(entry.id);
        if (!live) return true;
        if (live.deletedAt) return true;
        const liveUpdatedAtValue = Date.parse(live.updatedAt);
        return liveUpdatedAtValue < entry.deletedAt && existingIds.has(entry.id);
      });
      void this.setTombstones(nextTombstones);
    }

    return Array.from(records.values());
  }

  private async applyRemoteUpdates(updates: ApiTrailRecord[]): Promise<void> {
    const parsed = updates.map(parseRemoteTrail).filter((entry): entry is ParsedRemoteTrail => Boolean(entry));
    if (parsed.length === 0) return;

    const [activeMeta, archives, currentTombstones] = await Promise.all([
      treeStorage.getActiveMeta(),
      treeStorage.getArchives(),
      this.getTombstones(),
    ]);
    let nextActiveMeta: TreeMeta = activeMeta;
    const archivesMap = new Map(archives.map((record) => [record.id, record]));
    const tombstones = new Map(currentTombstones.map((entry) => [entry.id, entry]));
    let archivesChanged = false;
    let activeChanged = false;
    let tombstonesChanged = false;

    for (const remote of parsed) {
      if (remote.deletedAt !== null) {
        if (archivesMap.delete(remote.id)) {
          archivesChanged = true;
        }
        const prev = tombstones.get(remote.id);
        if (!prev || prev.deletedAt < remote.deletedAt) {
          tombstones.set(remote.id, {
            id: remote.id,
            label: remote.label,
            labelSource: remote.labelSource,
            labelUpdatedAt: remote.labelUpdatedAt,
            createdAt: remote.createdAt,
            savedAt: remote.savedAt,
            nodeCount: remote.nodeCount,
            rootUrl: remote.rootUrl ?? undefined,
            rootTitle: remote.rootTitle ?? undefined,
            rootFavicon: remote.rootFavicon ?? undefined,
            tree: remote.payload,
            deletedAt: remote.deletedAt,
          });
          tombstonesChanged = true;
        }
        continue;
      }

      if (tombstones.delete(remote.id)) {
        tombstonesChanged = true;
      }

      if (remote.id === activeMeta.id) {
        if (remote.labelUpdatedAt > activeMeta.labelUpdatedAt) {
          nextActiveMeta = {
            ...nextActiveMeta,
            label: remote.label,
            labelSource: remote.labelSource,
            labelUpdatedAt: remote.labelUpdatedAt,
          };
          activeChanged = true;
        }
        continue;
      }

      const incoming = toTreeRecordFromRemote(remote);
      const existing = archivesMap.get(incoming.id);
      if (!existing || getRecordUpdatedAt(existing) < getRecordUpdatedAt(incoming)) {
        archivesMap.set(incoming.id, incoming);
        archivesChanged = true;
      }
    }

    if (!activeChanged && !archivesChanged && !tombstonesChanged) return;

    this.applyingRemote = true;
    try {
      if (activeChanged) {
        await treeStorage.setActiveMeta(nextActiveMeta);
      }
      if (archivesChanged) {
        const nextArchives = Array.from(archivesMap.values()).sort((a, b) => b.savedAt - a.savedAt);
        await treeStorage.setArchives(nextArchives);
      }
      if (tombstonesChanged) {
        await this.setTombstones(Array.from(tombstones.values()));
      }
      const snapshot = {
        active: activeChanged ? nextActiveMeta : await treeStorage.getActiveMeta(),
        archived: archivesChanged
          ? Array.from(archivesMap.values()).map(toArchiveSummary)
          : await treeStorage.getArchivedSummaries(),
      };
      await notifyTreesUpdate(snapshot);
    } finally {
      this.applyingRemote = false;
    }
  }

  private async pruneAcknowledgedTombstones(serverSyncAtIso: string): Promise<void> {
    const serverSyncAt = Date.parse(serverSyncAtIso);
    if (!Number.isFinite(serverSyncAt)) return;
    const tombstones = await this.getTombstones();
    const next = tombstones.filter((entry) => entry.deletedAt > serverSyncAt);
    if (next.length === tombstones.length) return;
    await this.setTombstones(next);
  }

  private async getAccessToken(): Promise<string | null> {
    const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    return this.getTokenFromValue(result[AUTH_STORAGE_KEY]);
  }

  private getTokenFromValue(value: unknown): string | null {
    if (!isObject(value)) return null;
    const token = (value as StoredAuthSession).accessToken;
    return typeof token === 'string' && token ? token : null;
  }

  private async getOrCreateDeviceId(): Promise<string> {
    const result = await chrome.storage.local.get(SYNC_DEVICE_ID_KEY);
    const existing = result[SYNC_DEVICE_ID_KEY];
    if (typeof existing === 'string' && existing) return existing;

    const generated = uuidv7();
    await chrome.storage.local.set({ [SYNC_DEVICE_ID_KEY]: generated });
    return generated;
  }

  private async getClientSyncAt(): Promise<string> {
    const result = await chrome.storage.local.get(SYNC_SERVER_AT_KEY);
    const value = result[SYNC_SERVER_AT_KEY];
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
      return value;
    }
    return new Date(0).toISOString();
  }

  private async setClientSyncAt(value: string): Promise<void> {
    await chrome.storage.local.set({ [SYNC_SERVER_AT_KEY]: value });
  }

  private async getTombstones(): Promise<TombstoneRecord[]> {
    const result = await chrome.storage.local.get(SYNC_TOMBSTONES_KEY);
    return parseStoredTombstones(result[SYNC_TOMBSTONES_KEY]);
  }

  private async setTombstones(tombstones: TombstoneRecord[]): Promise<void> {
    await chrome.storage.local.set({ [SYNC_TOMBSTONES_KEY]: tombstones });
  }
}

export const cloudSync = new CloudSyncService();
