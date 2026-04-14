import { tabManager } from "@background/state/tab-manager.js";
import type { NodeId, TabId } from "@shared/types/ids.js";
import { browser, type Tab } from "@shared/platform/webext.js";
import { tabsService } from "@shared/transport/proxy-clients.js";

export async function getTabsForNode(nodeId: NodeId): Promise<Tab[]> {
  const tabs = tabManager.tabsByNode(nodeId);
  const tabsArray = Array.from(tabs);
  return Promise.all(
    tabsArray.map(async (tabId) => {
      const tab = await browser.tabs.get(tabId as TabId);
      return tab;
    }),
  );
}

export async function getTabsForNodeMessage(nodeId: NodeId): Promise<Tab[]> {
  return tabsService.getTabsForNode({ nodeId });
}
