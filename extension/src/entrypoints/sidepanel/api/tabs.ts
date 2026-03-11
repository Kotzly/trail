import { tabManager } from "@background/state/tab-manager.js";
import type { NodeId, TabId } from "@shared/types/ids.js";
import { rpc } from "@shared/rpc/contracts.js";
import { sendMessage } from "./background.js";
import { browser, type Tab } from '@shared/platform/webext.js';

export async function getTabsForNode(nodeId: NodeId): Promise<Tab[]> {
    const tabs = tabManager.tabsByNode(nodeId);
    const tabsArray = Array.from(tabs);
    return Promise.all(tabsArray.map(async (tabId) => {
        const tab = await browser.tabs.get(tabId as TabId);
        return tab;
    }));
}

export async function getTabsForNodeMessage(nodeId: NodeId): Promise<Tab[]> {
    const res = await sendMessage(rpc.getTabsForNode({ nodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data.tabs;
}