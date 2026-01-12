import type { NavigationTreeJSON } from '../../shared/types/tree.js';
import { NavigationTree } from '../state/nav-tree.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { settingsManager } from './settings.js';

const TREE_KEY = 'trail_tree' as const;
const treeArea = chrome.storage.local;


// Tree storage service for managing navigation trees in chrome.storage.
class TreeStorageService {
  cachedTree: NavigationTree | null = null;
  private loading: Promise<NavigationTree> | undefined = undefined;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly saveDebounceMs = 1500;

  constructor() {}

  async getOrCreateTree(): Promise<NavigationTree> {
    if (this.cachedTree) return this.cachedTree;
    if (this.loading) return this.loading;

    this.loading = (async() => { try {
      const result = await treeArea.get(TREE_KEY);
      const json = result[TREE_KEY] as NavigationTreeJSON | undefined;
      
      if (!json || !json.root) {
        const tree = new NavigationTree(settingsManager.get().capacity);
        this.cacheTree(tree);
        return tree;
      }
      
      this.cachedTree = NavigationTreeMapper.fromJSON(json);
      return this.cachedTree;
    } catch (error) {
      console.error('TreeStorageService.getTree: Error loading tree:', error);
      const capacity = settingsManager.get().capacity;
      return new NavigationTree(capacity);
    } finally {
      this.loading = undefined;
    }})()

    return this.loading;
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
    const tree = this.cachedTree;
    this.dirty = false;
    try {
      await this.saveTreeToChrome(tree);
    } catch (error) {
      console.error('TreeStorageService.flushSaveNow: Error saving tree:', error);
      this.dirty = true;
      this.scheduleSave();
    }
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
}

export const treeStorage = new TreeStorageService();
