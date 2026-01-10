import type { NavigationTreeJSON } from '../../shared/types/tree.js';
import { NavigationTree } from '../state/nav-tree.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { settingsManager } from './settings.js';

const TREE_KEY = 'trail_tree' as const;
const treeArea = chrome.storage.local;


// Tree storage service for managing navigation trees in chrome.storage.
class TreeStorageService {
  private static alarmListenerAttached = false;

  cachedTree: NavigationTree | null = null;
  private loading: Promise<NavigationTree> | undefined = undefined;
  private readonly saveAlarmName = 'trail_save_tree';

  constructor() {
    this.ensureAlarmListener();
    this.saveEvery(1); // save every minute by default
  }

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
  }

  // saveTreeToChrome will be handled by the background service as a cronjob
  async saveTreeToChrome(tree: NavigationTree) {
    const json = NavigationTreeMapper.toJSON(tree);
    await treeArea.set({ [TREE_KEY]: json });
  }

  saveEvery(minutes: number): void {
    chrome.alarms.clear(this.saveAlarmName);
    if (minutes <= 0) return;

    chrome.alarms.create(this.saveAlarmName, { periodInMinutes: minutes });
  }

  private ensureAlarmListener(): void {
    if (TreeStorageService.alarmListenerAttached) return;
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== this.saveAlarmName) return;
      if (this.cachedTree) {
        void this.saveTreeToChrome(this.cachedTree);
      }
    });
    TreeStorageService.alarmListenerAttached = true;
  }
}

export const treeStorage = new TreeStorageService();
