/**
 * SyncEngine — state-machine-based sync orchestrator.
 *
 * States: idle → syncing → idle | backoff
 *         backoff → syncing (on timer or manual override)
 *
 * Sync cycle:
 *   1. Index sync (POST /sync) → metadata delta → update local index
 *   2. Push dirty trees (PUT for each)
 *   3. Process pending deletes (DELETE for each)
 *   4. Commit (store serverSyncAt, notify UI)
 *
 * Tree pulls happen on-demand (user opens a tree), NOT during sync cycle.
 */

import { uuidv7 } from '@shared/lib/uuid.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import { findBestTrailFavicon } from '@shared/lib/tree-favicon.js';
import type { NavigationTreeJSON, TreeLabelSource, TreeMeta, TreeRecord, TreeSummary, ArchiveIndexEntry } from '@shared/types/tree.js';
import type { FaviconUrl, Title, Url } from '@shared/types/ids.js';
import { notifyTreesUpdate } from '../../messaging/notifications.js';
import { treeStorage } from '../tree-storage.js';
import { syncApi, SyncApiError, isAuthenticated } from './api.js';
import type { IndexSyncMeta } from './api.js';
import { dirtyTracker } from './dirty-tracker.js';
import { migrateV2ToV3 } from './migration.js';
import { browser } from '@shared/platform/webext.js';
import {
  activeTreeItem,
  activeTreeMetaItem,
  archiveIndexItem,
  syncDeviceIdItem,
} from '../../../shared/config/storage-items.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SYNC_ALARM_NAME = 'trail-sync-v3' as const;
const SYNC_ALARM_MINUTES = 1;
const MUTATION_DEBOUNCE_MS = 3000;

const BACKOFF_SCHEDULE = [2000, 4000, 8000, 16000, 32000, 60000] as const;

/* ------------------------------------------------------------------ */
/*  State types                                                        */
/* ------------------------------------------------------------------ */

type SyncState = 'idle' | 'syncing' | 'backoff';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeLabelSource(value: unknown): TreeLabelSource {
  if (value === 'user' || value === 'auto' || value === 'system') return value;
  return 'system';
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function getRecordUpdatedAt(record: {
  savedAt: number;
  labelUpdatedAt: number;
  createdAt: number;
  deletedAt?: number | null;
}): number {
  return Math.max(record.savedAt, record.labelUpdatedAt, record.createdAt, record.deletedAt ?? 0);
}

function metaToSummary(meta: IndexSyncMeta): ArchiveIndexEntry {
  const entry: ArchiveIndexEntry = {
    id: meta.id,
    label: meta.label,
    labelSource: normalizeLabelSource(meta.labelSource),
    labelUpdatedAt: Date.parse(meta.labelUpdatedAt),
    createdAt: Date.parse(meta.createdAt),
    nodeCount: meta.nodeCount,
    savedAt: Date.parse(meta.savedAt),
  };
  if (meta.rootUrl) (entry as TreeSummary).rootUrl = meta.rootUrl as Url;
  if (meta.rootTitle) (entry as TreeSummary).rootTitle = meta.rootTitle as Title;
  if (meta.rootFavicon) (entry as TreeSummary).rootFavicon = meta.rootFavicon as FaviconUrl;
  return entry;
}

/* ------------------------------------------------------------------ */
/*  SyncEngine                                                         */
/* ------------------------------------------------------------------ */

class SyncEngine {
  private state: SyncState = 'idle';
  private initialized = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private backoffAttempt = 0;
  private applyingRemote = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Run one-time v2→v3 migration before first sync
    void migrateV2ToV3();

    // Listen for local tree mutations via per-item watchers
    const onMutation = () => this.onTreeMutation();
    activeTreeItem.watch(onMutation);
    activeTreeMetaItem.watch(onMutation);
    archiveIndexItem.watch(onMutation);

    // Periodic alarm
    browser.alarms?.onAlarm.addListener((alarm) => {
      if (alarm.name !== SYNC_ALARM_NAME) return;
      void this.syncNow('alarm');
    });
    browser.alarms?.create(SYNC_ALARM_NAME, { periodInMinutes: SYNC_ALARM_MINUTES });

    // Initial sync after startup
    this.schedule(1000);
  }

  /**
   * Trigger a sync now. Deduplicates concurrent calls.
   */
  async syncNow(_trigger: 'manual' | 'alarm' | 'scheduled' = 'manual'): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.state = 'syncing';
    this.inFlight = this.performSyncCycle().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * Reset all sync state for account switch.
   */
  async resetForAccountSwitch(): Promise<void> {
    this.cancelTimer();
    this.inFlight = null;
    this.state = 'idle';
    this.backoffAttempt = 0;

    await dirtyTracker.clearAll();
    await treeStorage.clearArchivesOnly();

    const activeMeta = await treeStorage.getActiveMeta();
    await dirtyTracker.markDirty(activeMeta.id);

    await notifyTreesUpdate({
      active: activeMeta,
      archived: [],
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Core sync cycle                                                  */
  /* ---------------------------------------------------------------- */

  private async performSyncCycle(): Promise<void> {
    // Skip the entire cycle when the user is not authenticated.
    // This avoids unnecessary work and pointless 401 errors.
    if (!(await isAuthenticated())) {
      this.state = 'idle';
      return;
    }

    try {
      const deviceId = await this.getOrCreateDeviceId();
      const clientSyncAt = await dirtyTracker.getServerSyncAt();

      // Step 1: Index sync
      const indexResult = await syncApi.syncIndex(deviceId, clientSyncAt);

      // Apply metadata updates to local index
      await this.applyIndexUpdates(indexResult.updates);

      // Step 2: Push dirty trees
      const dirtyIds = await dirtyTracker.getDirtyIds();

      for (const treeId of dirtyIds) {
        await this.pushDirtyTree(treeId, deviceId);
      }

      // Step 3: Process pending deletes
      const pendingDeletes = await dirtyTracker.getPendingDeletes();
      for (const treeId of pendingDeletes) {
        try {
          await syncApi.deleteTree(treeId);
          await dirtyTracker.clearDelete(treeId);
        } catch (error) {
          if (error instanceof SyncApiError && error.kind === 'not_found') {
            await dirtyTracker.clearDelete(treeId);
          } else {
            throw error;
          }
        }
      }

      // Step 4: Commit
      await dirtyTracker.setServerSyncAt(indexResult.serverSyncAt);

      // Notify UI
      const snapshot = {
        active: await treeStorage.getActiveMeta(),
        archived: await treeStorage.getArchivedSummaries(),
      };
      await notifyTreesUpdate(snapshot);

      // Success: reset backoff
      this.backoffAttempt = 0;
      this.state = 'idle';
    } catch (error) {
      if (error instanceof SyncApiError) {
        if (!error.retryable) {
          // Non-retryable errors (auth, feature lock): stop syncing
          this.state = 'idle';
          return;
        }
      }
      // Enter backoff
      this.state = 'backoff';
      const delay = BACKOFF_SCHEDULE[Math.min(this.backoffAttempt, BACKOFF_SCHEDULE.length - 1)]!;
      this.backoffAttempt += 1;
      this.schedule(delay);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Index update application                                         */
  /* ---------------------------------------------------------------- */

  private async applyIndexUpdates(updates: IndexSyncMeta[]): Promise<void> {
    if (updates.length === 0) return;

    this.applyingRemote = true;
    try {
      const activeMeta = await treeStorage.getActiveMeta();
      const currentIndex = await treeStorage.getArchiveIndex();
      const indexMap = new Map(currentIndex.map((e) => [e.id, e]));

      let activeChanged = false;
      let indexChanged = false;

      for (const remote of updates) {
        const remoteUpdatedAt = Date.parse(remote.updatedAt);

        // Handle deleted trees
        if (remote.deletedAt) {
          if (indexMap.delete(remote.id)) {
            indexChanged = true;
            // Also remove the blob
            await treeStorage.deleteArchiveBlob(remote.id);
          }
          continue;
        }

        // Update active tree metadata
        if (remote.id === activeMeta.id) {
          const remoteLabelUpdatedAt = Date.parse(remote.labelUpdatedAt);
          if (remoteLabelUpdatedAt > activeMeta.labelUpdatedAt) {
            await treeStorage.setActiveMeta({
              ...activeMeta,
              label: remote.label,
              labelSource: normalizeLabelSource(remote.labelSource),
              labelUpdatedAt: remoteLabelUpdatedAt,
            });
            activeChanged = true;
          }
          continue;
        }

        // Update or add archive index entry
        const existing = indexMap.get(remote.id);
        const existingUpdatedAt = existing ? getRecordUpdatedAt(existing) : 0;
        if (!existing || existingUpdatedAt < remoteUpdatedAt) {
          const newEntry = metaToSummary(remote);
          indexMap.set(remote.id, newEntry);
          indexChanged = true;
          // Mark blob as stale — it will be re-fetched on demand
          // (we don't delete the blob here, the user may not need it)
        }
      }

      if (indexChanged) {
        const newIndex = Array.from(indexMap.values()).sort((a, b) => b.savedAt - a.savedAt);
        await treeStorage.setArchiveIndex(newIndex);
      }

      if (activeChanged || indexChanged) {
        const snapshot = {
          active: await treeStorage.getActiveMeta(),
          archived: await treeStorage.getArchivedSummaries(),
        };
        await notifyTreesUpdate(snapshot);
      }
    } finally {
      this.applyingRemote = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Push dirty tree                                                  */
  /* ---------------------------------------------------------------- */

  private async pushDirtyTree(treeId: string, deviceId: string): Promise<void> {
    // Build the full record for this tree
    const activeMeta = await treeStorage.getActiveMeta();
    let record: TreeRecord | null = null;

    if (activeMeta.id === treeId) {
      const tree = await treeStorage.getOrCreateTree();
      const treeJSON = NavigationTreeMapper.toJSON(tree);
      const savedAt = await treeStorage.getActiveSavedAt();
      const root = tree.getRoot();
      record = {
        ...activeMeta,
        nodeCount: tree.size(),
        savedAt,
        tree: treeJSON,
      };
      if (root?.data.url) record.rootUrl = root.data.url;
      if (root?.data.title) record.rootTitle = root.data.title;
      const favicon = findBestTrailFavicon(treeJSON) ?? root?.data.favicon;
      if (favicon) record.rootFavicon = favicon;
    } else {
      record = await treeStorage.getFullArchiveRecord(treeId);
    }

    if (!record) {
      // Tree was deleted locally, clean the dirty flag
      await dirtyTracker.markClean(treeId);
      return;
    }

    const updatedAt = getRecordUpdatedAt(record);
    try {
      await syncApi.pushTree({
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
      });
      await dirtyTracker.markClean(treeId);
    } catch (error) {
      // Re-throw so sync cycle enters backoff
      throw error;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Tree mutation handler (called by per-item watchers)               */
  /* ---------------------------------------------------------------- */

  private onTreeMutation(): void {
    if (this.applyingRemote) return;

    // Mark the active tree as dirty so the next sync cycle pushes it
    void treeStorage.getActiveMeta().then((meta) => {
      return dirtyTracker.markDirty(meta.id);
    });

    // Debounced sync on local mutation
    this.schedule(MUTATION_DEBOUNCE_MS);
  }

  /* ---------------------------------------------------------------- */
  /*  Scheduling                                                       */
  /* ---------------------------------------------------------------- */

  private schedule(delayMs: number): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow('scheduled');
    }, delayMs);
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Device ID                                                        */
  /* ---------------------------------------------------------------- */

  private async getOrCreateDeviceId(): Promise<string> {
    const existing = await syncDeviceIdItem.getValue();
    if (typeof existing === 'string' && existing) return existing;
    const generated = uuidv7();
    await syncDeviceIdItem.setValue(generated);
    return generated;
  }
}

export const syncEngine = new SyncEngine();
