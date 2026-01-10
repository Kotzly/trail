import type { Description, TabId } from '../../../shared/types/ids.js';
import { MSG, defineHandlers } from '../../../shared/types/messages.js';
import { tabManager } from '../../state/tab-manager.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { ok, err } from '../../../shared/types/messages.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';

async function focusTab(tabId: TabId): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
    return true;
  } catch (e) {
    return false;
  }
}

export const navigationHandlers = defineHandlers({
  async [MSG.NAVIGATE_TO](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const tabsArray = Array.from(tabManager.tabsByNode(message.nodeId));
    for (const tabId of tabsArray) {
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        tabManager.touch(tabId as TabId, message.nodeId);
        tree.setCurrentById(message.nodeId);
        await notifyTreeUpdate(tree);
        return ok();
      }
      tabManager.unregister(tabId as TabId);
    }

    const targetWindow = await chrome.windows.getLastFocused();
    const created = await chrome.tabs.create({
      windowId: targetWindow?.id,
      url: node.data.url,
      active: true,
    });

    if (created.id !== undefined) {
      tabManager.register(message.nodeId, created.id as TabId);
    }

    tree.setCurrentById(message.nodeId);
    await notifyTreeUpdate(tree);

    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), 'Navigate to' as Description);
    return ok();
  },

  async [MSG.OPEN_IN_NEW_TAB](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const tab = await chrome.tabs.create({ url: node.data.url, active: false });
    if (tab.id !== undefined) {
      tabManager.register(message.nodeId, tab.id as TabId);
    }

    await notifyTreeUpdate(tree);
    return ok();
  },
});
