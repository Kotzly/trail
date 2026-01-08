import { NodeId, TabId, Title, Url } from "../../shared/types/ids";
import { msg } from "../../shared/types/messages";
import { PanelState } from "../state/panel-state";
import { sendMessage } from "./background";

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
    sendMessage(msg.titleChanged(url, title)).catch(console.error);
}