import { NodeId, TabId, Title, Url } from "../../shared/types/ids.js";
import { msg } from "../../shared/types/messages.js";
import { PanelState } from "../state/panel-state.js";
import { fireAndForget } from "./background.js";

export async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

export async function getCurrentNodeId(): Promise<NodeId | undefined> {
    const tab = await getCurrentTab();
    if (!tab) return undefined;
    return PanelState.tabs.nodeByTab(tab.id as TabId);
}

export function notifyTitleChange(url: Url, title: Title): void {
    fireAndForget(msg.titleOrFaviconChanged({ url, title }));
}