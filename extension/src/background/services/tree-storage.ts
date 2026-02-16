import type { NavigationTreeJSON, TreeLabelSource, TreeMeta, TreeRecord, TreeSummary, ArchiveIndexEntry } from '../../shared/types/tree.js';
import { isTreeStub } from '../../shared/types/tree.js';
import { NavigationTree } from '../state/nav-tree.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { uuidv7 } from '../../shared/lib/uuid.js';
import { findBestTrailFavicon } from '../../shared/lib/tree-favicon.js';
import { encodeTree, decodeTree } from '../../shared/lib/tree-codec.js';
import { quotaAwareSet } from './quota-manager.js';
import { fetchTrailFromCloud } from './cloud-fetch.js';

// ---------------------------------------------------------------------------
// Storage key constants
// ---------------------------------------------------------------------------

const TREE_KEY = 'trail_tree' as const;
const TREE_META_KEY = 'trail_tree_meta' as const;
const TREE_ARCHIVES_KEY = 'trail_tree_archives' as const;
const TREE_SAVED_AT_KEY = 'trail_tree_saved_at' as const;

/** Per-tree compressed blob prefix: trail_ar_{treeId} */
const ARCHIVE_BLOB_PREFIX = 'trail_ar_' as const;

const treeArea = chrome.storage.local;
const DEFAULT_LABEL = 'Unnamed Tree';
const LABEL_MAX = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function archiveBlobKey(treeId: string): string {
  return `${ARCHIVE_BLOB_PREFIX}${treeId}`;
}

function normalizeLabel(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_LABEL;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, LABEL_MAX) : DEFAULT_LABEL;
}

function normalizeLabelSource(raw: unknown): TreeLabelSource {
  if (raw === 'user' || raw === 'auto' || raw === 'system') return raw;
  return 'system';
}

function normalizeMeta(raw: unknown): TreeMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<TreeMeta>;
  if (typeof candidate.id !== 'string') return null;
  const createdAt = Number.isFinite(candidate.createdAt) ? (candidate.createdAt as number) : Date.now();
  const labelUpdatedAt = Number.isFinite(candidate.labelUpdatedAt) ? (candidate.labelUpdatedAt as number) : createdAt;
  return {
    id: candidate.id,
    label: normalizeLabel(candidate.label),
    labelSource: normalizeLabelSource(candidate.labelSource),
    labelUpdatedAt,
    createdAt,
  } as TreeMeta;
}

function buildSummary(tree: NavigationTree, meta: TreeMeta, savedAt: number): TreeSummary {
  const root = tree.getRoot();
  const rootData = root?.data;
  const treeJSON = NavigationTreeMapper.toJSON(tree);
  return {
    ...meta,
    nodeCount: tree.size(),
    savedAt,
    rootUrl: rootData?.url,
    rootTitle: rootData?.title,
    rootFavicon: findBestTrailFavicon(treeJSON) ?? rootData?.favicon,
  } as TreeSummary;
}

/** Normalize a legacy TreeRecord stored in the old single-blob format. */
function normalizeLegacyRecord(raw: unknown): TreeRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<TreeRecord>;
  if (typeof candidate.id !== 'string') return null;
  if (!candidate.tree || typeof candidate.tree !== 'object') return null;
  const meta = normalizeMeta(candidate);
  if (!meta) return null;
  const savedAt = Number.isFinite(candidate.savedAt) ? (candidate.savedAt as number) : Date.now();
  const nodeCount = Number.isFinite(candidate.nodeCount) ? (candidate.nodeCount as number) : 0;
  const rootUrl = typeof candidate.rootUrl === 'string' ? candidate.rootUrl : undefined;
  const rootTitle = typeof candidate.rootTitle === 'string' ? candidate.rootTitle : undefined;
  const rootFavicon = typeof candidate.rootFavicon === 'string' ? candidate.rootFavicon : undefined;
  return {
    ...meta,
    savedAt,
    nodeCount,
    rootUrl,
    rootTitle,
    rootFavicon,
    tree: candidate.tree as NavigationTreeJSON,
  } as TreeRecord;
}

function normalizeIndexEntry(raw: unknown): ArchiveIndexEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<ArchiveIndexEntry>;
  if (typeof candidate.id !== 'string') return null;
  const meta = normalizeMeta(candidate);
  if (!meta) return null;
  const savedAt = Number.isFinite(candidate.savedAt) ? (candidate.savedAt as number) : Date.now();
  const nodeCount = Number.isFinite(candidate.nodeCount) ? (candidate.nodeCount as number) : 0;
  const entry: ArchiveIndexEntry = { ...meta, savedAt, nodeCount };
  if (typeof candidate.rootUrl === 'string') entry.rootUrl = candidate.rootUrl;
  if (typeof candidate.rootTitle === 'string') entry.rootTitle = candidate.rootTitle;
  if (typeof candidate.rootFavicon === 'string') entry.rootFavicon = candidate.rootFavicon;
  // Preserve stub marker
  if ('stub' in candidate && (candidate as unknown as { stub?: boolean }).stub === true) {
    (entry as unknown as { stub: true }).stub = true;
  }
  return entry;
}

function extractSummary(record: TreeRecord): TreeSummary {
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

/**
 * Safely coerce chrome.storage output back to Uint8Array.
 * Structured clone normally preserves Uint8Array, but some Chrome builds
 * return ArrayBuffer or even a plain numeric-keyed object.
 */
function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

// ---------------------------------------------------------------------------
// TreeStorageService
// ---------------------------------------------------------------------------

/**
 * Tree storage service for managing navigation trees in chrome.storage.
 *
 * Storage layout (v2 — per-tree archive keys):
 *   trail_tree_archives  → TreeSummary[]          (index, ~200 B/entry)
 *   trail_ar_{id}        → Uint8Array             (gzip-compressed compact tree)
 *   trail_tree            → NavigationTreeJSON      (active tree, uncompressed)
 *   trail_tree_meta       → TreeMeta               (active tree metadata)
 *   trail_tree_saved_at   → number                  (active tree save timestamp)
 */
class TreeStorageService {
  cachedTree: NavigationTree | null = null;
  cachedMeta: TreeMeta | null = null;
  private cachedIndex: ArchiveIndexEntry[] | null = null;
  private loading: Promise<NavigationTree> | undefined = undefined;
  private metaLoading: Promise<TreeMeta> | undefined = undefined;
  private indexLoading: Promise<ArchiveIndexEntry[]> | undefined = undefined;
  private cachedSavedAt: number | null = null;
  private savedAtLoading: Promise<number> | undefined = undefined;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDebounceMs = 1500;
  private migrated = false;

  /**
   * When true, the cached tree is an editor tree for a non-active (archived)
   * tree.  flushSaveNow() will skip persisting to TREE_KEY so the real active
   * tree in chrome.storage is never overwritten.
   */
  private _editingNonActiveTree = false;

  get isEditingNonActiveTree(): boolean {
    return this._editingNonActiveTree;
  }

  setEditingNonActiveTree(value: boolean): void {
    this._editingNonActiveTree = value;
  }

  constructor() {}

  // -----------------------------------------------------------------------
  // Active tree
  // -----------------------------------------------------------------------

  async getOrCreateTree(): Promise<NavigationTree> {
    if (this.cachedTree) return this.cachedTree;
    if (this.loading) return this.loading;

    this.loading = (async () => { try {
      await this.ensureMigrated();
      await this.getActiveMeta();
      const result = await treeArea.get(TREE_KEY);
      const json = result[TREE_KEY] as NavigationTreeJSON | undefined;

      if (!json || !json.root) {
        const tree = new NavigationTree();
        this.cachedTree = tree;
        return tree;
      }

      this.cachedTree = NavigationTreeMapper.fromJSON(json);
      return this.cachedTree;
    } catch (error) {
      console.error('TreeStorageService.getTree: Error loading tree:', error);
      const tree = new NavigationTree();
      this.cachedTree = tree;
      return tree;
    } finally {
      this.loading = undefined;
    }})();

    return this.loading;
  }

  async getActiveMeta(): Promise<TreeMeta> {
    if (this.cachedMeta) return this.cachedMeta;
    if (this.metaLoading) return this.metaLoading;

    this.metaLoading = (async () => {
      try {
        const result = await treeArea.get(TREE_META_KEY);
        const raw = result[TREE_META_KEY] as TreeMeta | undefined;
        const normalized = normalizeMeta(raw);
        if (normalized) {
          this.cachedMeta = normalized;
          return normalized;
        }
      } catch (error) {
        console.error('TreeStorageService.getActiveMeta: Error loading meta:', error);
      }

      const createdAt = Date.now();
      const meta: TreeMeta = {
        id: uuidv7(),
        label: DEFAULT_LABEL,
        labelSource: 'system',
        labelUpdatedAt: createdAt,
        createdAt,
      };
      this.cachedMeta = meta;
      try {
        await treeArea.set({ [TREE_META_KEY]: meta });
      } catch (error) {
        console.error('TreeStorageService.getActiveMeta: Error saving meta:', error);
      }
      return meta;
    })();

    return this.metaLoading.finally(() => {
      this.metaLoading = undefined;
    });
  }

  createMeta(label: string, source: TreeLabelSource = 'user'): TreeMeta {
    const now = Date.now();
    return {
      id: uuidv7(),
      label: normalizeLabel(label),
      labelSource: source,
      labelUpdatedAt: now,
      createdAt: now,
    };
  }

  async setActiveMeta(meta: TreeMeta): Promise<void> {
    this.cachedMeta = meta;
    try {
      await treeArea.set({ [TREE_META_KEY]: meta });
    } catch (error) {
      console.error('TreeStorageService.setActiveMeta: Error saving meta:', error);
    }
  }

  async setActiveTree(tree: NavigationTree, meta: TreeMeta): Promise<void> {
    this.cachedTree = tree;
    this.dirty = true;
    this.scheduleSave();
    await this.setActiveMeta(meta);
    await this.setActiveSavedAt(Date.now());
  }

  cacheTree(tree: NavigationTree): void {
    this.cachedTree = tree;
    this.dirty = true;
    this.scheduleSave();
  }

  async saveTreeToChrome(tree: NavigationTree) {
    const json = NavigationTreeMapper.toJSON(tree);
    await treeArea.set({ [TREE_KEY]: json });
  }

  async flushSaveNow(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty || !this.cachedTree) return;

    // Guard: never persist the editor tree to TREE_KEY when editing
    // a non-active (archived) tree — cloud sync handles persistence.
    if (this._editingNonActiveTree) {
      this.dirty = false;
      return;
    }

    const tree = this.cachedTree;
    this.dirty = false;
    try {
      await this.saveTreeToChrome(tree);
      await this.setActiveSavedAt(Date.now());
    } catch (error) {
      console.error('TreeStorageService.flushSaveNow: Error saving tree:', error);
      this.dirty = true;
      this.scheduleSave();
    }
  }

  /**
   * Reload the active tree from chrome.storage, discarding the in-memory
   * cached (editor) tree.  Called when exiting editor mode so the UI gets
   * the real active tree back.
   */
  async restoreActiveTreeFromStorage(): Promise<NavigationTree> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.dirty = false;
    this.cachedTree = null;
    this.loading = undefined;
    return this.getOrCreateTree();
  }

  async getActiveSavedAt(): Promise<number> {
    if (this.cachedSavedAt !== null) return this.cachedSavedAt;
    if (this.savedAtLoading) return this.savedAtLoading;

    this.savedAtLoading = (async () => {
      try {
        const result = await treeArea.get(TREE_SAVED_AT_KEY);
        const raw = result[TREE_SAVED_AT_KEY];
        if (Number.isFinite(raw)) {
          this.cachedSavedAt = raw as number;
          return this.cachedSavedAt;
        }
      } catch (error) {
        console.error('TreeStorageService.getActiveSavedAt: Error loading savedAt:', error);
      }

      const now = Date.now();
      this.cachedSavedAt = now;
      try {
        await treeArea.set({ [TREE_SAVED_AT_KEY]: now });
      } catch (error) {
        console.error('TreeStorageService.getActiveSavedAt: Error saving default savedAt:', error);
      }
      return now;
    })();

    return this.savedAtLoading.finally(() => {
      this.savedAtLoading = undefined;
    });
  }

  // -----------------------------------------------------------------------
  // Archive index (summaries only — fast, lightweight)
  // -----------------------------------------------------------------------

  /**
   * Return the archive index (summaries without tree payloads).
   * Entries may be stubs (payload only on server) — check with isTreeStub().
   */
  async getArchiveIndex(): Promise<ArchiveIndexEntry[]> {
    if (this.cachedIndex) return this.cachedIndex;
    if (this.indexLoading) return this.indexLoading;
    this.indexLoading = (async () => {
      try {
        await this.ensureMigrated();
        const result = await treeArea.get(TREE_ARCHIVES_KEY);
        const raw = result[TREE_ARCHIVES_KEY] as unknown;
        const rawArr = Array.isArray(raw) ? raw : [];
        const list = rawArr.map(normalizeIndexEntry).filter((entry): entry is ArchiveIndexEntry => Boolean(entry));
        this.cachedIndex = list;
        return list;
      } catch (error) {
        console.error('TreeStorageService.getArchiveIndex: Error loading index:', error);
        this.cachedIndex = [];
        return this.cachedIndex;
      } finally {
        this.indexLoading = undefined;
      }
    })();
    return this.indexLoading;
  }

  /** Return summaries only (strips stubs). Used by UI / tree-handlers. */
  async getArchivedSummaries(): Promise<ArchiveIndexEntry[]> {
    return this.getArchiveIndex();
  }

  // -----------------------------------------------------------------------
  // Per-tree compressed blobs
  // -----------------------------------------------------------------------

  /**
   * Load a single archived tree's payload (decompressed).
   * Returns null if the blob is missing (e.g. stub or deleted).
   */
  async getArchiveTree(treeId: string): Promise<NavigationTreeJSON | null> {
    try {
      const key = archiveBlobKey(treeId);
      const result = await treeArea.get(key);
      const raw = result[key];
      if (!raw) return null;
      const bytes = toUint8Array(raw);
      if (!bytes) return null;
      return decodeTree(bytes);
    } catch (error) {
      console.error(`TreeStorageService.getArchiveTree(${treeId}): decode error`, error);
      return null;
    }
  }

  /**
   * Save a compressed tree blob for one archive entry.
   */
  async saveArchiveTree(treeId: string, tree: NavigationTreeJSON): Promise<void> {
    const key = archiveBlobKey(treeId);
    const compressed = encodeTree(tree);
    await treeArea.set({ [key]: compressed });
  }

  // -----------------------------------------------------------------------
  // Full archive operations (load all trees — used by cloud-sync)
  // -----------------------------------------------------------------------

  /**
   * Load ALL archived trees with their full payloads.
   * This is the slow path — loads and decompresses every tree.
   * Stubs are skipped (they have no local blob).
   * Used by cloud-sync and editor fallback.
   */
  async getArchives(): Promise<TreeRecord[]> {
    const index = await this.getArchiveIndex();
    const records: TreeRecord[] = [];
    for (const entry of index) {
      if (isTreeStub(entry)) continue;
      const tree = await this.getArchiveTree(entry.id);
      if (!tree) continue;
      records.push({ ...entry, tree });
    }
    return records;
  }

  /**
   * Replace all archives with the given records.
   * Writes index + individual compressed blobs via quotaAwareSet.
   * Also removes blobs for trees no longer in the set.
   */
  async setArchives(records: TreeRecord[]): Promise<void> {
    const prevIndex = await this.getArchiveIndex();
    const prevIds = new Set(prevIndex.map((e) => e.id));
    const nextIds = new Set(records.map((r) => r.id));

    const writes: Record<string, unknown> = {};
    const entries: ArchiveIndexEntry[] = [];

    for (const record of records) {
      entries.push(extractSummary(record));
      writes[archiveBlobKey(record.id)] = encodeTree(record.tree);
    }
    writes[TREE_ARCHIVES_KEY] = entries;
    this.cachedIndex = entries;

    try {
      await quotaAwareSet(writes);
    } catch (error) {
      console.error('TreeStorageService.setArchives: Error writing:', error);
    }

    // Remove blobs for trees that were removed from the set
    const removedIds = [...prevIds].filter((id) => !nextIds.has(id));
    if (removedIds.length > 0) {
      try {
        await treeArea.remove(removedIds.map(archiveBlobKey));
      } catch (error) {
        console.error('TreeStorageService.setArchives: Error cleaning old blobs:', error);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Archive mutations
  // -----------------------------------------------------------------------

  async archiveActiveTree(): Promise<TreeRecord | null> {
    const tree = await this.getOrCreateTree();
    const root = tree.getRoot();
    if (!root) return null;
    const meta = await this.getActiveMeta();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const summary = buildSummary(tree, meta, Date.now());
    const record: TreeRecord = { ...summary, tree: treeJSON };

    const index = await this.getArchiveIndex();
    const nextIndex = [extractSummary(record), ...index.filter((e) => e.id !== meta.id)];
    this.cachedIndex = nextIndex;

    try {
      await quotaAwareSet({
        [TREE_ARCHIVES_KEY]: nextIndex,
        [archiveBlobKey(record.id)]: encodeTree(treeJSON),
      });
    } catch (error) {
      console.error('TreeStorageService.archiveActiveTree: Error saving:', error);
    }
    return record;
  }

  async takeArchivedTree(treeId: string): Promise<TreeRecord | null> {
    const index = await this.getArchiveIndex();
    const idx = index.findIndex((e) => e.id === treeId);
    if (idx < 0) return null;

    const summary = index[idx]!;
    const tree = await this.getArchiveTree(treeId);
    if (!tree) return null;

    // Remove from index and delete blob
    const nextIndex = [...index];
    nextIndex.splice(idx, 1);
    this.cachedIndex = nextIndex;

    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: nextIndex });
      await treeArea.remove(archiveBlobKey(treeId));
    } catch (error) {
      console.error('TreeStorageService.takeArchivedTree: Error removing:', error);
    }

    return { ...summary, tree };
  }

  /**
   * Get a full TreeRecord for a single archived tree.
   * Combines index summary + decompressed blob.
   */
  async getFullArchiveRecord(treeId: string): Promise<TreeRecord | null> {
    const index = await this.getArchiveIndex();
    const entry = index.find((e) => e.id === treeId);
    if (!entry) return null;
    if (isTreeStub(entry)) return null; // stub has no local blob
    const tree = await this.getArchiveTree(treeId);
    if (!tree) return null;
    return { ...entry, tree };
  }

  /**
   * Ensure a tree is loaded and return its full record.
   * Priority: active tree → archive blob → cloud fetch (if in index)
   * Returns null if the tree doesn't exist anywhere.
   */
  async ensureTreeLoaded(treeId: string): Promise<TreeRecord | null> {
    // 1. Check if it's the active tree
    const activeMeta = await this.getActiveMeta();
    if (activeMeta.id === treeId) {
      const tree = await this.getOrCreateTree();
      const treeJSON = NavigationTreeMapper.toJSON(tree);
      return {
        ...activeMeta,
        nodeCount: tree.size(),
        savedAt: Date.now(),
        tree: treeJSON,
      };
    }

    // 2. Check if archived tree has blob
    const fullRecord = await this.getFullArchiveRecord(treeId);
    if (fullRecord) return fullRecord;

    // 3. Check if it's in the index but has no blob (stub or never downloaded)
    const index = await this.getArchiveIndex();
    const entry = index.find((e) => e.id === treeId);
    if (entry) {
      const cloudTree = await fetchTrailFromCloud(treeId);
      if (cloudTree) {
        await this.saveArchiveTree(treeId, cloudTree);
        await this.unstubArchiveEntry(treeId);
        return {
          ...entry,
          savedAt: Date.now(),
          tree: cloudTree,
        };
      }
    }

    return null;
  }

  /**
   * Check if an archive entry is a stub (payload only on server).
   */
  async isStub(treeId: string): Promise<boolean> {
    const index = await this.getArchiveIndex();
    const entry = index.find((e) => e.id === treeId);
    return entry ? isTreeStub(entry) : false;
  }

  /**
   * Remove the stub marker from an archive entry after rehydrating
   * its compressed blob from the cloud.
   */
  async unstubArchiveEntry(treeId: string): Promise<void> {
    const index = await this.getArchiveIndex();
    const idx = index.findIndex((e) => e.id === treeId);
    if (idx < 0) return;
    const entry = index[idx]!;
    if (!isTreeStub(entry)) return;

    // Reconstruct without the stub flag
    const { stub, ...summary } = entry;
    index[idx] = summary as TreeSummary;
    this.cachedIndex = index;
    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: index });
    } catch (error) {
      console.error('TreeStorageService.unstubArchiveEntry: Error:', error);
    }
  }

  async renameTree(treeId: string, label: string): Promise<void> {
    const nextLabel = normalizeLabel(label);
    const now = Date.now();
    const active = await this.getActiveMeta();
    if (active.id === treeId) {
      const next = {
        ...active,
        label: nextLabel,
        labelSource: 'user' as const,
        labelUpdatedAt: now,
      };
      await this.setActiveMeta(next);
    }
    const index = await this.getArchiveIndex();
    const idx = index.findIndex((e) => e.id === treeId);
    if (idx >= 0) {
      const current = index[idx]!;
      index[idx] = {
        ...current,
        label: nextLabel,
        labelSource: 'user',
        labelUpdatedAt: now,
      };
      this.cachedIndex = index;
      try {
        await treeArea.set({ [TREE_ARCHIVES_KEY]: index });
      } catch (error) {
        console.error('TreeStorageService.renameTree: Error saving index:', error);
      }
    }
  }

  async deleteArchivedTree(treeId: string): Promise<boolean> {
    const index = await this.getArchiveIndex();
    const next = index.filter((e) => e.id !== treeId);
    if (next.length === index.length) return false;
    this.cachedIndex = next;
    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: next });
      await treeArea.remove(archiveBlobKey(treeId));
    } catch (error) {
      console.error('TreeStorageService.deleteArchivedTree: Error:', error);
    }
    return true;
  }

  /**
   * Update an archived tree's payload and summary.
   * Used by editor-sync after saving changes.
   */
  async updateArchivedTree(treeId: string, tree: NavigationTree, savedAt: number): Promise<void> {
    const index = await this.getArchiveIndex();
    const idx = index.findIndex((e) => e.id === treeId);
    if (idx < 0) return;

    const existing = index[idx]!;
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const root = tree.getRoot();
    const favicon = findBestTrailFavicon(treeJSON) ?? root?.data.favicon;

    const updated: TreeSummary = {
      id: existing.id,
      label: existing.label,
      labelSource: existing.labelSource,
      labelUpdatedAt: existing.labelUpdatedAt,
      createdAt: existing.createdAt,
      nodeCount: tree.size(),
      savedAt,
      ...(root?.data.url && { rootUrl: root.data.url }),
      ...(root?.data.title && { rootTitle: root.data.title }),
      ...(favicon && { rootFavicon: favicon }),
    };

    index[idx] = updated;
    this.cachedIndex = index;

    try {
      await quotaAwareSet({
        [TREE_ARCHIVES_KEY]: index,
        [archiveBlobKey(treeId)]: encodeTree(treeJSON),
      });
    } catch (error) {
      console.error('TreeStorageService.updateArchivedTree: Error:', error);
    }
  }

  // -----------------------------------------------------------------------
  // Migration from legacy single-blob format
  // -----------------------------------------------------------------------

  /**
   * One-time migration from the old format (TreeRecord[] in a single key)
   * to the new per-tree format (summary index + individual compressed blobs).
   */
  private async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;

    try {
      const result = await treeArea.get(TREE_ARCHIVES_KEY);
      const raw = result[TREE_ARCHIVES_KEY];
      if (!Array.isArray(raw) || raw.length === 0) return;

      // Detect legacy format: entries have a 'tree' field with an object value
      const first = raw[0];
      if (!first || typeof first !== 'object') return;
      if (!('tree' in first) || !first.tree || typeof first.tree !== 'object') {
        // Already new format (summaries without tree field)
        return;
      }

      console.log(`TreeStorageService: migrating ${raw.length} legacy archives to per-tree format`);

      const summaries: TreeSummary[] = [];
      const writes: Record<string, unknown> = {};

      for (const entry of raw) {
        const record = normalizeLegacyRecord(entry);
        if (!record) continue;
        summaries.push(extractSummary(record));
        writes[archiveBlobKey(record.id)] = encodeTree(record.tree);
      }

      writes[TREE_ARCHIVES_KEY] = summaries;
      await treeArea.set(writes);
      this.cachedIndex = summaries;

      console.log(`TreeStorageService: migrated ${summaries.length} archives successfully`);
    } catch (error) {
      console.error('TreeStorageService.ensureMigrated: Migration error:', error);
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flushSaveNow();
    }, this.saveDebounceMs);
  }

  private async setActiveSavedAt(savedAt: number): Promise<void> {
    this.cachedSavedAt = savedAt;
    try {
      await treeArea.set({ [TREE_SAVED_AT_KEY]: savedAt });
    } catch (error) {
      console.error('TreeStorageService.setActiveSavedAt: Error saving savedAt:', error);
    }
  }
}

export const treeStorage = new TreeStorageService();
