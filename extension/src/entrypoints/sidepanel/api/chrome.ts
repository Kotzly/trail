import { NodeId, TabId, Title, Url } from "@shared/types/ids.js";
import { rpc } from "@shared/rpc/contracts.js";
import { fireAndForget } from "./background.js";
import { tabManager } from "@background/state/tab-manager.js";

export async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

export async function getCurrentNodeId(): Promise<NodeId | undefined> {
    const tab = await getCurrentTab();
    if (!tab) return undefined;
    return tabManager.nodeByTab(tab.id as TabId);
}

export function notifyTitleChange(url: Url, title: Title): void {
    fireAndForget(rpc.titleOrFaviconChanged({ url, title }));
}
