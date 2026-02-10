import type { NavigationTreeJSON, TreeLabelSource, TreeMeta, TreeRecord, TreeSummary } from '../../shared/types/tree.js';
import { NavigationTree } from '../state/nav-tree.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { uuidv7 } from '../../shared/lib/uuid.js';
import { settingsManager } from './settings.js';

const TREE_KEY = 'trail_tree' as const;
const TREE_META_KEY = 'trail_tree_meta' as const;
const TREE_ARCHIVES_KEY = 'trail_tree_archives' as const;
const TREE_SAVED_AT_KEY = 'trail_tree_saved_at' as const;
const treeArea = chrome.storage.local;
const DEFAULT_LABEL = 'Unnamed Tree';
const LABEL_MAX = 80;

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
  return {
    ...meta,
    nodeCount: tree.size(),
    savedAt,
    rootUrl: rootData?.url,
    rootTitle: rootData?.title,
    rootFavicon: rootData?.favicon,
  } as TreeSummary;
}

function normalizeRecord(raw: unknown): TreeRecord | null {
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

// Tree storage service for managing navigation trees in chrome.storage.
class TreeStorageService {
  cachedTree: NavigationTree | null = null;
  cachedMeta: TreeMeta | null = null;
  private cachedArchives: TreeRecord[] | null = null;
  private loading: Promise<NavigationTree> | undefined = undefined;
  private metaLoading: Promise<TreeMeta> | undefined = undefined;
  private archivesLoading: Promise<TreeRecord[]> | undefined = undefined;
  private cachedSavedAt: number | null = null;
  private savedAtLoading: Promise<number> | undefined = undefined;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDebounceMs = 1500;

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

  async getOrCreateTree(): Promise<NavigationTree> {
    if (this.cachedTree) return this.cachedTree;
    if (this.loading) return this.loading;

    this.loading = (async() => { try {
      await this.getActiveMeta();
      const result = await treeArea.get(TREE_KEY);
      const json = result[TREE_KEY] as NavigationTreeJSON | undefined;
      
      if (!json || !json.root) {
        const tree = new NavigationTree(settingsManager.get().capacity);
        this.cachedTree = tree;
        return tree;
      }
      
      this.cachedTree = NavigationTreeMapper.fromJSON(json);
      return this.cachedTree;
    } catch (error) {
      console.error('TreeStorageService.getTree: Error loading tree:', error);
      const capacity = settingsManager.get().capacity;
      const tree = new NavigationTree(capacity);
      this.cachedTree = tree;
      return tree;
    } finally {
      this.loading = undefined;
    }})()

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

  async archiveActiveTree(): Promise<TreeRecord | null> {
    const tree = await this.getOrCreateTree();
    const root = tree.getRoot();
    if (!root) return null;
    const meta = await this.getActiveMeta();
    const record: TreeRecord = {
      ...buildSummary(tree, meta, Date.now()),
      tree: NavigationTreeMapper.toJSON(tree),
    };
    const archives = await this.getArchives();
    const next = [record, ...archives.filter((entry) => entry.id !== meta.id)];
    this.cachedArchives = next;
    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: next });
    } catch (error) {
      console.error('TreeStorageService.archiveActiveTree: Error saving archive:', error);
    }
    return record;
  }

  async takeArchivedTree(treeId: string): Promise<TreeRecord | null> {
    const archives = await this.getArchives();
    const index = archives.findIndex((entry) => entry.id === treeId);
    if (index < 0) return null;
    const [record] = archives.splice(index, 1);
    this.cachedArchives = archives;
    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: archives });
    } catch (error) {
      console.error('TreeStorageService.takeArchivedTree: Error updating archive:', error);
    }
    return record ?? null;
  }

  async getArchivedSummaries(): Promise<TreeSummary[]> {
    const archives = await this.getArchives();
    return archives.map((record) => {
      const summary: TreeSummary = {
        id: record.id,
        label: record.label,
        labelSource: record.labelSource,
        labelUpdatedAt: record.labelUpdatedAt,
        createdAt: record.createdAt,
        nodeCount: record.nodeCount,
        savedAt: record.savedAt,
      };
      if (typeof record.rootUrl === 'string') summary.rootUrl = record.rootUrl;
      if (typeof record.rootTitle === 'string') summary.rootTitle = record.rootTitle;
      if (typeof record.rootFavicon === 'string') summary.rootFavicon = record.rootFavicon;
      return summary;
    });
  }

  async setArchives(records: TreeRecord[]): Promise<void> {
    this.cachedArchives = records;
    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: records });
    } catch (error) {
      console.error('TreeStorageService.setArchives: Error saving archives:', error);
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
    const archives = await this.getArchives();
    const idx = archives.findIndex((entry) => entry.id === treeId);
    if (idx >= 0) {
      const current = archives[idx]!;
      archives[idx] = {
        ...current,
        label: nextLabel,
        labelSource: 'user',
        labelUpdatedAt: now,
      };
      this.cachedArchives = archives;
      try {
        await treeArea.set({ [TREE_ARCHIVES_KEY]: archives });
      } catch (error) {
        console.error('TreeStorageService.renameTree: Error saving archive:', error);
      }
    }
  }

  async deleteArchivedTree(treeId: string): Promise<boolean> {
    const archives = await this.getArchives();
    const next = archives.filter((entry) => entry.id !== treeId);
    if (next.length === archives.length) return false;
    this.cachedArchives = next;
    try {
      await treeArea.set({ [TREE_ARCHIVES_KEY]: next });
    } catch (error) {
      console.error('TreeStorageService.deleteArchivedTree: Error saving archive:', error);
    }
    return true;
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

  async getArchives(): Promise<TreeRecord[]> {
    if (this.cachedArchives) return this.cachedArchives;
    if (this.archivesLoading) return this.archivesLoading;
    this.archivesLoading = (async () => {
      try {
        const result = await treeArea.get(TREE_ARCHIVES_KEY);
        const raw = result[TREE_ARCHIVES_KEY] as unknown;
        const list = Array.isArray(raw)
          ? raw.map(normalizeRecord).filter((entry): entry is TreeRecord => Boolean(entry))
          : [];
        this.cachedArchives = list;
        return list;
      } catch (error) {
        console.error('TreeStorageService.getArchives: Error loading archives:', error);
        this.cachedArchives = [];
        return this.cachedArchives;
      } finally {
        this.archivesLoading = undefined;
      }
    })();
    return this.archivesLoading;
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
    // Cancel any pending save of the editor tree
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.dirty = false;

    // Force a fresh load from chrome.storage
    this.cachedTree = null;
    this.loading = undefined;
    return this.getOrCreateTree();
  }

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
