import type { FaviconUrl, TabId, Timestamp, Title, Url } from "./ids.js";

export type SidebarNavigationKey = `${TabId}:${Url}`;

export interface SidebarNavigation {
  tabId: TabId;
  url: Url;
}

export function newSidebarNavigationKey(nav: SidebarNavigation): SidebarNavigationKey {
  return `${nav.tabId}:${nav.url}`;
}

export function parseSidebarNavigationKey(key: SidebarNavigationKey): SidebarNavigation {
  const idx = key.indexOf(":");
  if (idx === -1) {
    throw new Error(`Invalid SidebarNavigationKey: ${key}`);
  }

  const tabIdStr = key.slice(0, idx);
  const url = key.slice(idx + 1);

  const tabId = Number(tabIdStr);
  if (!Number.isInteger(tabId) || url.length === 0) {
    throw new Error(`Invalid SidebarNavigationKey: ${key}`);
  }

  return {
    tabId: tabId as TabId,
    url: url as Url,
  };
}

export interface NavigationEntry {
  url: Url;
  title: Title;
  favicon: FaviconUrl;
  timestamp: Timestamp;
}
