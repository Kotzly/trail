import { z } from "zod";
import { Mutex } from "async-mutex";
import { storage } from "wxt/utils/storage";
import {
  isTreeStub,
  type NavigationTreeJSON,
  type TreeLabelSource,
  type TreeMeta,
  type TreeRecord,
  type TreeStub,
  type TreeSummary,
  type TreeIndexEntry,
} from "@shared/types/tree.js";
import { NavigationTree } from "../state/nav-tree.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { uuidv7 } from "@shared/lib/uuid.js";
import { findBestTrailFavicon } from "@shared/lib/tree-favicon.js";
import { buildNewTabRootData, isNewTabUrl } from "@shared/lib/root.js";
import { encodeTree, decodeTree } from "@shared/lib/tree-codec.js";
import {
  activeTreeItem,
  activeTreeMetaItem,
  treeIndexItem,
  treeSavedAtItem,
  treeBlobKey,
} from "../../shared/config/storage-items.js";
import type { FaviconUrl, Title, Url } from "@shared/types/ids.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("tree-storage");

type BulkEntry =
  | { item: { setValue: (v: unknown) => Promise<void> }; value: unknown }
  | {
      key: `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`;
      value: unknown;
    };

/** Adapter to satisfy the BulkEntry item shape (which uses `unknown` for generic bulk writes). */
const treeIndexBulkItem: { key: string; setValue: (v: unknown) => Promise<void> } = {
  get key() {
    return treeIndexItem.key;
  },
  setValue: (v) => treeIndexItem.setValue(v as TreeIndexEntry[]),
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LABEL = "Unnamed Tree";
const LABEL_MAX = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const labelSchema = z
  .unknown()
  .transform((raw) => (typeof raw === "string" ? raw.trim().slice(0, LABEL_MAX) : ""))
  .transform((s) => s || DEFAULT_LABEL);

const labelSourceSchema = z
  .unknown()
  .transform(
    (raw): TreeLabelSource =>
      raw === "user" || raw === "auto" || raw === "system" ? raw : "system",
  );

const finiteNumberOr = (fallback: () => number) =>
  z
    .unknown()
    .transform((raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : fallback()));

const optionalString = z.unknown().transform((raw) => (typeof raw === "string" ? raw : undefined));

const metaSchema = z
  .object({
    id: z.string(),
    label: labelSchema,
    labelSource: labelSourceSchema,
    createdAt: finiteNumberOr(() => Date.now()),
    labelUpdatedAt: z.unknown(),
  })
  .transform(
    ({ id, label, labelSource, createdAt, labelUpdatedAt }) =>
      ({
        id,
        label,
        labelSource,
        createdAt,
        labelUpdatedAt:
          typeof labelUpdatedAt === "number" && Number.isFinite(labelUpdatedAt)
            ? labelUpdatedAt
            : createdAt,
      }) satisfies TreeMeta,
  );

function normalizeMeta(raw: unknown): TreeMeta | null {
  const parsed = metaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function normalizeLabel(raw: unknown): string {
  return labelSchema.parse(raw);
}

function buildSummary(tree: NavigationTree, meta: TreeMeta, savedAt: number): TreeSummary {
  const treeJSON = NavigationTreeMapper.toJSON(tree);
  const identifying = pickIdentifyingNode(tree);
  const rootData = identifying?.data;
  return {
    ...meta,
    nodeCount: tree.size(),
    savedAt,
    rootUrl: rootData?.url,
    rootTitle: rootData?.title,
    rootFavicon: findBestTrailFavicon(treeJSON) ?? rootData?.favicon,
  } as TreeSummary;
}

/**
 * Pick the node that best identifies the tree in summary UI. The actual
 * root is the synthetic `chrome://newtab/` wrapper which renders as a
 * useless "newtab" host. Navigation handlers keep `tree.current` in sync
 * with `markNodeVisited`, so it already tracks the last active node —
 * use it directly.
 *
 * Fallbacks (current is null → user on an untrackable surface, or still
 * points at the synthetic NTP root):
 * - NTP root with ≥1 child → first child
 * - otherwise → the root itself (empty or legacy non-NTP tree)
 */
function pickIdentifyingNode(tree: NavigationTree): ReturnType<NavigationTree["getRoot"]> {
  const current = tree.getCurrent();
  if (current && !isNewTabUrl(current.data.url)) return current;

  const root = tree.getRoot();
  if (!root) return null;
  if (isNewTabUrl(root.data.url)) {
    const [firstChild] = root.getChildren();
    return firstChild ?? root;
  }
  return root;
}

/**
 * Public helper used by the sync push path so the cloud row carries the
 * same identifying url/title/favicon as the local summary.
 */
export function pickTreeIdentifyingData(tree: NavigationTree): {
  url?: Url;
  title?: Title;
  favicon?: FaviconUrl;
} {
  const node = pickIdentifyingNode(tree);
  if (!node) return {};
  const { url, title, favicon } = node.data;
  return {
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(favicon ? { favicon } : {}),
  };
}

const optionalFiniteNumber = z
  .unknown()
  .transform((raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : undefined));

const indexEntryExtrasSchema = z.object({
  savedAt: finiteNumberOr(() => Date.now()),
  nodeCount: finiteNumberOr(() => 0),
  rootUrl: optionalString,
  rootTitle: optionalString,
  rootFavicon: optionalString,
  lastOpenedAt: optionalFiniteNumber,
  stub: z.unknown().transform((raw) => raw === true),
});

function normalizeIndexEntry(raw: unknown): TreeIndexEntry | null {
  const meta = normalizeMeta(raw);
  if (!meta) return null;
  const extras = indexEntryExtrasSchema.safeParse(raw);
  if (!extras.success) return null;
  const entry = {
    ...meta,
    savedAt: extras.data.savedAt,
    nodeCount: extras.data.nodeCount,
  } as TreeIndexEntry;
  if (extras.data.rootUrl) entry.rootUrl = extras.data.rootUrl as Url;
  if (extras.data.rootTitle) entry.rootTitle = extras.data.rootTitle as Title;
  if (extras.data.rootFavicon) entry.rootFavicon = extras.data.rootFavicon as FaviconUrl;
  if (extras.data.lastOpenedAt !== undefined) entry.lastOpenedAt = extras.data.lastOpenedAt;
  if (extras.data.stub) return { ...entry, stub: true as const } satisfies TreeStub;
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
  if (record.lastOpenedAt !== undefined) summary.lastOpenedAt = record.lastOpenedAt;
  return summary;
}

/**
 * Convert a Uint8Array to a base64 string for storage.
 */
function serializeBlob(data: Uint8Array): string {
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Safely coerce storage output back to Uint8Array.
 */
function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (typeof data === "string") {
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      return null;
    }
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  return null;
}

const legacyRecordExtrasSchema = z.object({
  tree: z.record(z.string(), z.unknown()),
  savedAt: finiteNumberOr(() => Date.now()),
  nodeCount: finiteNumberOr(() => 0),
  rootUrl: optionalString,
  rootTitle: optionalString,
  rootFavicon: optionalString,
});

/** Normalize a legacy TreeRecord stored in the old single-blob format. */
function normalizeLegacyRecord(raw: unknown): TreeRecord | null {
  const meta = normalizeMeta(raw);
  if (!meta) return null;
  const extras = legacyRecordExtrasSchema.safeParse(raw);
  if (!extras.success) return null;
  return {
    ...meta,
    savedAt: extras.data.savedAt,
    nodeCount: extras.data.nodeCount,
    rootUrl: extras.data.rootUrl as Url | undefined,
    rootTitle: extras.data.rootTitle as Title | undefined,
    rootFavicon: extras.data.rootFavicon as FaviconUrl | undefined,
    tree: extras.data.tree as unknown as NavigationTreeJSON,
  } as TreeRecord;
}

// ---------------------------------------------------------------------------
// Mutex for tree operations
// ---------------------------------------------------------------------------

export const treeMutex = new Mutex();

/**
 * Run `fn` under the tree mutex. All mutation paths must wrap their
 * tree writes here; persistence (cacheTree/flushSaveNow) uses the same
 * lock so readers see consistent state.
 *
 * PATTERN: read externals (browser.tabs.get, queries) OUTSIDE the lock.
 * The lock is narrow — no I/O to Chrome APIs inside `fn`.
 */
export function withTreeLock<T>(fn: () => Promise<T>): Promise<T> {
  const waitStart = Date.now();
  return treeMutex.runExclusive(() => {
    const waited = Date.now() - waitStart;
    if (waited > 1500) {
      log.warn("Lock acquisition slow", { waitedMs: waited });
    }
    return fn();
  });
}

// ---------------------------------------------------------------------------
// TreeStorageService
// ---------------------------------------------------------------------------

class TreeStorageService {
  cachedTree: NavigationTree | null = null;
  cachedMeta: TreeMeta | null = null;
  private cachedIndex: TreeIndexEntry[] | null = null;
  private loading: Promise<NavigationTree> | undefined = undefined;
  private metaLoading: Promise<TreeMeta> | undefined = undefined;
  private indexLoading: Promise<TreeIndexEntry[]> | undefined = undefined;
  private cachedSavedAt: number | null = null;
  private savedAtLoading: Promise<number> | undefined = undefined;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDebounceMs = 1500;
  private migrated = false;

  /**
   * Monotonically increasing counter bumped on every tree mutation.
   * Used by the sidepanel to drop stale snapshots (see useBootstrap
   * generation guard). Resets to 0 on service-worker restart; consumers
   * treat it as session-local, not persisted.
   */
  private generation = 0;

  getGeneration(): number {
    return this.generation;
  }

  /** Internal: bump the generation. Call after every successful mutation under `withTreeLock`. */
  bumpGeneration(): number {
    return ++this.generation;
  }

  /**
   * When true, the cached tree is an editor tree for a non-active tree.
   * flushSaveNow() will skip persisting so the real active tree in
   * storage is never overwritten.
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
    return this._getOrCreateTreeInner();
  }

  /** Inner loader — callers under withTreeLock use this to avoid re-entry. */
  private _getOrCreateTreeInner(): Promise<NavigationTree> {
    if (this.cachedTree) return Promise.resolve(this.cachedTree);
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        await this.ensureMigrated();
        await this.getActiveMeta();
        const json = await activeTreeItem.getValue();

        if (!json || !json.root) {
          const tree = new NavigationTree();
          tree.navigate(buildNewTabRootData());
          this.cachedTree = tree;
          return tree;
        }

        this.cachedTree = NavigationTreeMapper.fromTrustedJSON(json);
        return this.cachedTree;
      } catch (error) {
        log.error("Error loading tree", {
          error: error instanceof Error ? error.message : String(error),
        });
        const tree = new NavigationTree();
        tree.navigate(buildNewTabRootData());
        this.cachedTree = tree;
        return tree;
      } finally {
        this.loading = undefined;
      }
    })();

    return this.loading;
  }

  async getActiveMeta(): Promise<TreeMeta> {
    if (this.cachedMeta) return this.cachedMeta;
    if (this.metaLoading) return this.metaLoading;

    this.metaLoading = (async () => {
      try {
        const raw = await activeTreeMetaItem.getValue();
        const normalized = normalizeMeta(raw);
        if (normalized) {
          this.cachedMeta = normalized;
          return normalized;
        }
      } catch (error) {
        log.error("Error loading meta", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const createdAt = Date.now();
      const meta: TreeMeta = {
        id: uuidv7(),
        label: DEFAULT_LABEL,
        labelSource: "system",
        labelUpdatedAt: createdAt,
        createdAt,
      };
      this.cachedMeta = meta;
      try {
        await activeTreeMetaItem.setValue(meta);
      } catch (error) {
        log.error("Error saving default meta", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return meta;
    })();

    return this.metaLoading.finally(() => {
      this.metaLoading = undefined;
    });
  }

  createMeta(label: string, source: TreeLabelSource = "user"): TreeMeta {
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
      await activeTreeMetaItem.setValue(meta);
    } catch (error) {
      log.error("Error saving meta", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async setActiveTree(tree: NavigationTree, meta: TreeMeta): Promise<void> {
    return withTreeLock(async () => {
      this.cachedTree = tree;
      this.dirty = true;
      this.scheduleSave();
      await this.setActiveMeta(meta);
      await this.setActiveSavedAt(Date.now());
    });
  }

  cacheTree(tree: NavigationTree): void {
    this.cachedTree = tree;
    this.dirty = true;
    this.bumpGeneration();
    this.scheduleSave();
  }

  async saveTreeToChrome(tree: NavigationTree) {
    const json = NavigationTreeMapper.toJSON(tree);
    await activeTreeItem.setValue(json);
  }

  async flushSaveNow(): Promise<void> {
    return withTreeLock(async () => {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      if (!this.dirty || !this.cachedTree) return;

      if (this._editingNonActiveTree) {
        this.dirty = false;
        return;
      }

      const tree = this.cachedTree;
      try {
        await this.saveTreeToChrome(tree);
        // Set dirty = false ONLY after the save resolves. If the SW is
        // terminated mid-await, dirty stays true and the next wake
        // re-flushes (#56). Previously dirty was lowered pre-await,
        // so SW termination during the write silently dropped the
        // pending mutation from the dirty tracker.
        this.dirty = false;
        await this.setActiveSavedAt(Date.now());
        const treeJSON = NavigationTreeMapper.toJSON(tree);
        void import("../messaging/notifications.js")
          .then(({ requestLayoutRefinement }) => {
            requestLayoutRefinement(treeJSON);
          })
          .catch((error) => {
            log.warn("Failed to refresh layout cache after flush", {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      } catch (error) {
        log.error("Error flushing tree save", {
          error: error instanceof Error ? error.message : String(error),
        });
        // dirty is already true (never lowered), schedule a retry.
        this.scheduleSave();
      }
    });
  }

  async restoreActiveTreeFromStorage(): Promise<NavigationTree> {
    return withTreeLock(async () => {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      this.dirty = false;
      this.cachedTree = null;
      this.loading = undefined;
      return this._getOrCreateTreeInner();
    });
  }

  async getActiveSavedAt(): Promise<number> {
    if (this.cachedSavedAt !== null) return this.cachedSavedAt;
    if (this.savedAtLoading) return this.savedAtLoading;

    this.savedAtLoading = (async () => {
      try {
        const raw = await treeSavedAtItem.getValue();
        if (Number.isFinite(raw)) {
          this.cachedSavedAt = raw as number;
          return this.cachedSavedAt;
        }
      } catch (error) {
        log.error("Error loading savedAt", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const now = Date.now();
      this.cachedSavedAt = now;
      try {
        await treeSavedAtItem.setValue(now);
      } catch (error) {
        log.error("Error saving default savedAt", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return now;
    })();

    return this.savedAtLoading.finally(() => {
      this.savedAtLoading = undefined;
    });
  }

  // -----------------------------------------------------------------------
  // Tree index (summaries only — fast, lightweight)
  // -----------------------------------------------------------------------

  async getTreeIndex(): Promise<TreeIndexEntry[]> {
    if (this.cachedIndex) return this.cachedIndex;
    if (this.indexLoading) return this.indexLoading;
    this.indexLoading = (async () => {
      try {
        await this.ensureMigrated();
        const rawArr = await treeIndexItem.getValue();
        const list = rawArr
          .map(normalizeIndexEntry)
          .filter((entry): entry is TreeIndexEntry => Boolean(entry));
        this.cachedIndex = list;
        return list;
      } catch (error) {
        log.error("Error loading tree index", {
          error: error instanceof Error ? error.message : String(error),
        });
        this.cachedIndex = [];
        return this.cachedIndex;
      } finally {
        this.indexLoading = undefined;
      }
    })();
    return this.indexLoading;
  }

  async getStoredSummaries(): Promise<TreeIndexEntry[]> {
    return this.getTreeIndex();
  }

  /**
   * Replace the tree index directly. Used by sync engine.
   */
  async setTreeIndex(index: TreeIndexEntry[]): Promise<void> {
    return withTreeLock(async () => {
      this.cachedIndex = index;
      try {
        await treeIndexItem.setValue(index);
      } catch (error) {
        log.error("Error saving tree index", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Drop every remote-only stub entry from the local tree index. Stubs
   * are pointers to trees that exist on the server but were never
   * downloaded locally — they're inaccessible while signed out and
   * showing them as "available" would mislead. Trees with local
   * payload are preserved.
   */
  async dropRemoteStubs(): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const localOnly = index.filter((entry) => !isTreeStub(entry));
      if (localOnly.length === index.length) return;
      this.cachedIndex = localOnly;
      try {
        await treeIndexItem.setValue(localOnly);
      } catch (error) {
        log.error("Error dropping remote stubs", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Per-tree compressed blobs
  // -----------------------------------------------------------------------

  async getStoredTree(treeId: string): Promise<NavigationTreeJSON | null> {
    try {
      const raw = await storage.getItem<unknown>(treeBlobKey(treeId));
      if (!raw) return null;
      const bytes = toUint8Array(raw);
      if (!bytes) return null;
      return decodeTree(bytes);
    } catch (error) {
      log.error("Stored tree decode error", {
        treeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async saveStoredTree(treeId: string, tree: NavigationTreeJSON): Promise<void> {
    const compressed = encodeTree(tree);
    const blob = serializeBlob(compressed);
    await storage.setItem(treeBlobKey(treeId), blob);
  }

  /**
   * Insert a brand-new stored tree (blob + index entry) from a JSON
   * payload. Used by the sync-conflict fork flow to snapshot the user's
   * local work before force-pulling the server copy.
   *
   * If an entry with the same id already exists, it is replaced.
   */
  async addStoredTreeFromJSON(meta: TreeMeta, json: NavigationTreeJSON): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const root = json.root;
      const identifying = root?.data;
      const summary: TreeSummary = {
        ...meta,
        nodeCount: json.nodeCount,
        savedAt: Date.now(),
        ...(identifying?.url ? { rootUrl: identifying.url } : {}),
        ...(identifying?.title ? { rootTitle: identifying.title } : {}),
        ...((findBestTrailFavicon(json) ?? identifying?.favicon)
          ? { rootFavicon: findBestTrailFavicon(json) ?? identifying?.favicon }
          : {}),
      };
      const nextIndex = [summary, ...index.filter((e) => e.id !== meta.id)];
      this.cachedIndex = nextIndex;
      await writeBulkDirect([
        { item: treeIndexBulkItem, value: nextIndex },
        { key: treeBlobKey(meta.id), value: serializeBlob(encodeTree(json)) },
      ]);
    });
  }

  /**
   * Delete just the blob for a stored tree entry. Used by sync engine
   * when a remote delete is received.
   */
  async deleteStoredBlob(treeId: string): Promise<void> {
    try {
      await storage.removeItem(treeBlobKey(treeId));
    } catch (error) {
      log.error("Error deleting stored tree blob", {
        treeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // -----------------------------------------------------------------------
  // Full stored-tree operations (load all trees)
  // -----------------------------------------------------------------------

  async getAllStoredTrees(): Promise<TreeRecord[]> {
    const index = await this.getTreeIndex();
    const records: TreeRecord[] = [];
    for (const entry of index) {
      if (isTreeStub(entry)) continue;
      const tree = await this.getStoredTree(entry.id);
      if (!tree) continue;
      records.push({ ...entry, tree });
    }
    return records;
  }

  async setAllStoredTrees(records: TreeRecord[]): Promise<void> {
    return withTreeLock(async () => {
      const prevIndex = await this.getTreeIndex();
      const prevIds = new Set(prevIndex.map((e) => e.id));
      const nextIds = new Set(records.map((r) => r.id));

      const entries: BulkEntry[] = [];
      const summaries: TreeIndexEntry[] = [];

      for (const record of records) {
        summaries.push(extractSummary(record));
        entries.push({
          key: treeBlobKey(record.id),
          value: serializeBlob(encodeTree(record.tree)),
        });
      }
      entries.push({ item: treeIndexBulkItem, value: summaries });
      this.cachedIndex = summaries;

      try {
        await writeBulkDirect(entries);
      } catch (error) {
        log.error("Error writing stored trees", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const removedIds = [...prevIds].filter((id) => !nextIds.has(id));
      if (removedIds.length > 0) {
        try {
          for (const id of removedIds) {
            await storage.removeItem(treeBlobKey(id));
          }
        } catch (error) {
          log.error("Error cleaning old tree blobs", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }

  // -----------------------------------------------------------------------
  // Stored-tree mutations
  // -----------------------------------------------------------------------

  async stashActiveTree(): Promise<TreeRecord | null> {
    return withTreeLock(async () => {
      const tree = await this._getOrCreateTreeInner();
      const root = tree.getRoot();
      if (!root) return null;
      const meta = await this.getActiveMeta();
      const treeJSON = NavigationTreeMapper.toJSON(tree);
      const now = Date.now();
      const summary = buildSummary(tree, meta, now);
      summary.lastOpenedAt = now;
      const record: TreeRecord = { ...summary, tree: treeJSON };

      const index = await this.getTreeIndex();
      const nextIndex = [extractSummary(record), ...index.filter((e) => e.id !== meta.id)];
      this.cachedIndex = nextIndex;

      const blob = serializeBlob(encodeTree(treeJSON));
      try {
        await writeBulkDirect([
          { item: treeIndexBulkItem, value: nextIndex },
          { key: treeBlobKey(record.id), value: blob },
        ]);
      } catch (error) {
        log.error("Error stashing active tree", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return record;
    });
  }

  async takeStoredTree(treeId: string): Promise<TreeRecord | null> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const idx = index.findIndex((e) => e.id === treeId);
      if (idx < 0) return null;

      const summary = index[idx]!;
      const tree = await this.getStoredTree(treeId);
      if (!tree) {
        // Orphan entry: index has the tree but the blob is missing.
        // Prune it so it stops showing in the switcher.
        log.warn("takeStoredTree: blob missing, pruning orphan index entry", {
          treeId,
          stub: isTreeStub(summary),
        });
        const prunedIndex = [...index];
        prunedIndex.splice(idx, 1);
        this.cachedIndex = prunedIndex;
        try {
          await treeIndexItem.setValue(prunedIndex);
        } catch (error) {
          log.error("Error pruning orphan tree index entry", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return null;
      }

      const nextIndex = [...index];
      nextIndex.splice(idx, 1);
      this.cachedIndex = nextIndex;

      try {
        await treeIndexItem.setValue(nextIndex);
        await storage.removeItem(treeBlobKey(treeId));
      } catch (error) {
        log.error("Error taking stored tree", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return { ...summary, tree };
    });
  }

  async getFullStoredRecord(treeId: string): Promise<TreeRecord | null> {
    const index = await this.getTreeIndex();
    const entry = index.find((e) => e.id === treeId);
    if (!entry) return null;
    if (isTreeStub(entry)) return null;
    const tree = await this.getStoredTree(treeId);
    if (!tree) return null;
    return { ...entry, tree };
  }

  async unstubTreeEntry(treeId: string): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const idx = index.findIndex((e) => e.id === treeId);
      if (idx < 0) return;
      const entry = index[idx]!;
      if (!isTreeStub(entry)) return;

      const { stub: _stub, ...summary } = entry;
      const next = { ...summary, lastOpenedAt: Date.now() } as TreeSummary;
      index[idx] = next;
      this.cachedIndex = index;
      try {
        await treeIndexItem.setValue(index);
      } catch (error) {
        log.error("Error unstubbing tree entry", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Record that a tree was opened/touched locally. Used by the storage
   * retention sweeper to sort candidates by recency. Cheap no-op if
   * the entry is missing or already a stub (stubs aren't candidates).
   */
  async touchLastOpened(treeId: string): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const idx = index.findIndex((e) => e.id === treeId);
      if (idx < 0) return;
      const entry = index[idx]!;
      const next = { ...entry, lastOpenedAt: Date.now() };
      index[idx] = next;
      this.cachedIndex = index;
      try {
        await treeIndexItem.setValue(index);
      } catch (error) {
        log.error("Error updating lastOpenedAt", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Mark a local index entry as `stub: true` so the local blob can be
   * dropped while keeping the cloud-backed summary visible. Inverse of
   * `unstubTreeEntry`. The caller is responsible for removing the
   * per-tree blob separately (via `deleteStoredBlob`).
   */
  async stubTreeEntry(treeId: string): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const idx = index.findIndex((e) => e.id === treeId);
      if (idx < 0) return;
      const entry = index[idx]!;
      if (isTreeStub(entry)) return;

      index[idx] = { ...entry, stub: true as const };
      this.cachedIndex = index;
      try {
        await treeIndexItem.setValue(index);
      } catch (error) {
        log.error("Error stubbing tree entry", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  async renameTree(treeId: string, label: string): Promise<void> {
    return withTreeLock(async () => {
      const nextLabel = normalizeLabel(label);
      const now = Date.now();
      const active = await this.getActiveMeta();
      if (active.id === treeId) {
        const next = {
          ...active,
          label: nextLabel,
          labelSource: "user" as const,
          labelUpdatedAt: now,
        };
        await this.setActiveMeta(next);
      }
      const index = await this.getTreeIndex();
      const idx = index.findIndex((e) => e.id === treeId);
      if (idx >= 0) {
        const current = index[idx]!;
        index[idx] = {
          ...current,
          label: nextLabel,
          labelSource: "user",
          labelUpdatedAt: now,
        };
        this.cachedIndex = index;
        try {
          await treeIndexItem.setValue(index);
        } catch (error) {
          log.error("Error saving renamed tree index", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }

  async clearStoredTrees(): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();

      // Best-effort cleanup: try each removal independently so one
      // failure doesn't abort the rest (#55). Previously a single
      // try wrapped the loop, leaving partial state behind on any
      // throw.
      try {
        await treeIndexItem.removeValue();
      } catch (error) {
        log.warn("clearStoredTrees: index removeValue failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      for (const e of index) {
        try {
          await storage.removeItem(treeBlobKey(e.id));
        } catch (error) {
          log.warn("clearStoredTrees: blob removeItem failed", {
            id: e.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.cachedIndex = null;
      this.indexLoading = undefined;
    });
  }

  async clearAllTrees(): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();

      // Per-key try: any single removeItem failure doesn't block the
      // rest (#55).
      const safeRemove = async (label: string, fn: () => Promise<void>): Promise<void> => {
        try {
          await fn();
        } catch (error) {
          log.warn(`clearAllTrees: ${label} failed`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };
      await safeRemove("activeTree", () => activeTreeItem.removeValue());
      await safeRemove("activeTreeMeta", () => activeTreeMetaItem.removeValue());
      await safeRemove("treeIndex", () => treeIndexItem.removeValue());
      await safeRemove("treeSavedAt", () => treeSavedAtItem.removeValue());
      for (const e of index) {
        await safeRemove(`blob:${e.id}`, () => storage.removeItem(treeBlobKey(e.id)));
      }

      this.cachedTree = null;
      this.cachedMeta = null;
      this.cachedIndex = null;
      this.cachedSavedAt = null;
      this.loading = undefined;
      this.metaLoading = undefined;
      this.indexLoading = undefined;
      this.savedAtLoading = undefined;
      this._editingNonActiveTree = false;
      this.dirty = false;
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
    });
  }

  async deleteTree(treeId: string): Promise<boolean> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const next = index.filter((e) => e.id !== treeId);
      if (next.length === index.length) return false;
      this.cachedIndex = next;
      try {
        await treeIndexItem.setValue(next);
        await storage.removeItem(treeBlobKey(treeId));
      } catch (error) {
        log.error("Error deleting tree", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return true;
    });
  }

  async updateStoredTree(treeId: string, tree: NavigationTree, savedAt: number): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
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
        await writeBulkDirect([
          { item: treeIndexBulkItem, value: index },
          { key: treeBlobKey(treeId), value: serializeBlob(encodeTree(treeJSON)) },
        ]);
      } catch (error) {
        log.error("Error updating stored tree", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Like `updateStoredTree` but also carries a merged label into the
   * index. Used by the sync-conflict apply path where the user picked
   * a specific label side (may differ from both the stored label and
   * whatever `renameTree` would force via `labelSource: "user"`).
   *
   * Accepts NavigationTreeJSON directly (not `NavigationTree`) because
   * the merge runs in pure-function land before entering this storage
   * layer.
   */
  async updateStoredTreeWithLabel(
    treeId: string,
    treeJSON: NavigationTreeJSON,
    label: string,
    labelSource: TreeLabelSource,
    labelUpdatedAt: number,
    savedAt: number,
  ): Promise<void> {
    return withTreeLock(async () => {
      const index = await this.getTreeIndex();
      const idx = index.findIndex((e) => e.id === treeId);
      if (idx < 0) return;

      const existing = index[idx]!;
      const root = treeJSON.root;
      const favicon = findBestTrailFavicon(treeJSON) ?? root?.data.favicon;

      const updated: TreeSummary = {
        id: existing.id,
        label,
        labelSource,
        labelUpdatedAt,
        createdAt: existing.createdAt,
        nodeCount: treeJSON.nodeCount,
        savedAt,
        ...(root?.data.url && { rootUrl: root.data.url }),
        ...(root?.data.title && { rootTitle: root.data.title }),
        ...(favicon && { rootFavicon: favicon }),
      };

      index[idx] = updated;
      this.cachedIndex = index;

      try {
        await writeBulkDirect([
          { item: treeIndexBulkItem, value: index },
          { key: treeBlobKey(treeId), value: serializeBlob(encodeTree(treeJSON)) },
        ]);
      } catch (error) {
        log.error("Error updating stored tree with label", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Migration from legacy single-blob format
  // -----------------------------------------------------------------------

  /**
   * Singleflight guard for `ensureMigrated`. Previous implementation
   * set `this.migrated = true` BEFORE awaiting the storage reads, so
   * a second caller arriving during the migration saw "done" and read
   * legacy-shape cached data. We now cache the in-flight promise and
   * only mark migrated AFTER the work completes successfully.
   */
  private migrationPromise: Promise<void> | null = null;

  private async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    if (this.migrationPromise) return this.migrationPromise;

    this.migrationPromise = (async () => {
      try {
        const rawArr = await treeIndexItem.getValue();
        if (rawArr.length === 0) {
          this.migrated = true;
          return;
        }

        const first = rawArr[0];
        if (!first || typeof first !== "object") {
          this.migrated = true;
          return;
        }
        if (!("tree" in first) || !first.tree || typeof first.tree !== "object") {
          this.migrated = true;
          return;
        }

        // Migrating legacy stored trees to per-tree blob format.
        const summaries: TreeSummary[] = [];
        const entries: BulkEntry[] = [];

        for (const entry of rawArr) {
          const record = normalizeLegacyRecord(entry);
          if (!record) continue;
          summaries.push(extractSummary(record));
          entries.push({
            key: treeBlobKey(record.id),
            value: serializeBlob(encodeTree(record.tree)),
          });
        }

        entries.push({ item: treeIndexBulkItem, value: summaries });
        await writeBulkDirect(entries);
        this.cachedIndex = summaries;
        this.migrated = true;
      } catch (error) {
        log.error("Migration error", {
          error: error instanceof Error ? error.message : String(error),
        });
        // Clear the in-flight promise on failure so a subsequent call
        // retries. Do NOT set `migrated = true` — we want retry next.
        throw error;
      }
    })().catch((error) => {
      this.migrationPromise = null;
      throw error;
    });

    return this.migrationPromise;
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
      await treeSavedAtItem.setValue(savedAt);
    } catch (error) {
      log.error("Error saving savedAt", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Direct bulk write without quota-aware retry (used for migration). */
async function writeBulkDirect(entries: BulkEntry[]): Promise<void> {
  for (const entry of entries) {
    if ("item" in entry) {
      await entry.item.setValue(entry.value);
    } else {
      await storage.setItem(entry.key, entry.value);
    }
  }
}

export const treeStorage = new TreeStorageService();
