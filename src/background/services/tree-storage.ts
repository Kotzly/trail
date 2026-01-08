import type { TabId, NodeId } from '../../shared/types/ids.js';
import type { NavigationTreeJSON } from '../../shared/types/tree.js';
import { NavigationTree } from '../state/nav-tree.js';
import { NavigationTreeMapper, TreeNodeMapper } from '../../shared/lib/mapper.js';
import { settingsManager } from './settings.js';

const TREE_KEY = 'trail_tree' as const;
const treeArea = chrome.storage.sync;


// Tree storage service for managing navigation trees in chrome.storage.
class TreeStorageService {
  async getTree(): Promise<NavigationTree> {
    try {
      const result = await treeArea.get(TREE_KEY);
      const json = result[TREE_KEY] as NavigationTreeJSON | undefined;
      
      if (!json || !json.root) {
        console.warn("no tree stored, creating new tree with capacity:", settingsManager.get().capacity);
        return new NavigationTree(settingsManager.get().capacity);
      }
      
      return NavigationTreeMapper.fromJSON(json);
    } catch (error) {
      console.error('TreeStorageService.getTree: Error loading tree:', error);
      const capacity = settingsManager.get().capacity;
      return new NavigationTree(capacity);
    }
  }

  async saveTree(tree: NavigationTree): Promise<void> {
      const json = NavigationTreeMapper.toJSON(tree);
      await treeArea.set({ [TREE_KEY]: json }).catch(error => {
        console.error('TreeStorageService.saveTree: Error saving tree:', error);
        throw error;
      });
  }
}

export const treeStorage = new TreeStorageService();
