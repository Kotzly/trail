import { type NodeId, type TabId, type Title, type Url } from "@shared/types/ids.js";
import { tabManager } from "@background/state/tab-manager.js";
import { browser, type Tab } from "@shared/platform/webext.js";
import {
  EXTENSION_MESSAGE,
  fireExtensionEvent,
} from "@shared/transport/extension-messaging.js";

export async function getCurrentTab(): Promise<Tab | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function getCurrentNodeId(): Promise<NodeId | undefined> {
  const tab = await getCurrentTab();
  if (!tab) return undefined;
  return tabManager.nodeByTab(tab.id as TabId);
}

export function notifyTitleChange(url: Url, title: Title): void {
  fireExtensionEvent(EXTENSION_MESSAGE.TITLE_OR_FAVICON_CHANGED, { url, title });
}
