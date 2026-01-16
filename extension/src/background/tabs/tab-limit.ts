import type { TabId } from '../../shared/types/ids.js';
import type { NavigationTree } from '../state/nav-tree.js';
import { settingsManager } from '../services/settings.js';
import { tabManager } from '../state/tab-manager.js';
import { notifyUi } from '../messaging/ui-notifications.js';

type EnforceOptions = {
  activeTabId?: TabId | null;
};

export async function enforceTabLimit(
  tree: NavigationTree,
  options?: EnforceOptions,
): Promise<number> {
  const limit = settingsManager.get().maxOpenTabs;
  if (!Number.isFinite(limit) || limit <= 0) return 0;

  const activeTabs = await chrome.tabs.query({ active: true });
  const activeTabIds = new Set<TabId>();
  activeTabs.forEach((tab) => {
    if (tab.id !== undefined) activeTabIds.add(tab.id as TabId);
  });
  if (options?.activeTabId !== undefined && options.activeTabId !== null) {
    activeTabIds.add(options.activeTabId);
  }

  const closed = await tabManager.closeOldestUntil(limit, tree, {
    activeTabIds,
    skipLoading: true,
  });

  if (closed > 0) {
    notifyUi({
      message: `Closed ${closed} tab${closed === 1 ? '' : 's'} due to tab limit`,
      icon: 'Bell',
      durationMs: 5000,
    });
  }

  return closed;
}
