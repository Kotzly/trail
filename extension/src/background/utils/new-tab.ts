import type { NodeId, TabId, Title, Url, FaviconUrl } from '../../shared/types/ids.js';
import type { NavigationTree } from '../state/nav-tree.js';
import type { NodeData } from '../../shared/types/node.js';
import { tabManager } from '../state/tab-manager.js';
import { isNewTabContext, normalizeFaviconUrl } from './url-utils.js';

type NewTabHandleOptions = {
  touch: boolean;
  setCurrent: boolean;
};

type NewTabHandleResult = {
  handled: boolean;
  rootId: NodeId | null;
  didMutate: boolean;
  didUpdateCurrent: boolean;
};

export function handleNewTabTab(
  tree: NavigationTree,
  tab: chrome.tabs.Tab,
  url: Url,
  options: NewTabHandleOptions
): NewTabHandleResult {
  if (!isNewTabContext(url, tab.title)) {
    return { handled: false, rootId: null, didMutate: false, didUpdateCurrent: false };
  }
  if (!tab.id) {
    return { handled: true, rootId: null, didMutate: false, didUpdateCurrent: false };
  }

  const isActiveTab = options.setCurrent;
  const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
  const registerOptions =
    lastUsed === undefined ? { touch: options.touch } : { touch: options.touch, lastUsed };

  const rawFavicon = tab.favIconUrl as FaviconUrl | undefined;
  const normalizedFavicon = normalizeFaviconUrl(url, rawFavicon);
  const canUpdateRootFavicon = Boolean(normalizedFavicon);

  let didMutate = false;
  const root = tree.getRoot();
  let rootId: NodeId;

  if (!root) {
    const data: NodeData = {
      url,
      title: (tab.title || url) as Title,
      favicon: normalizedFavicon,
      pinned: false,
      tags: [],
    } as NodeData;
    const node = tree.navigate(data);
    rootId = node.id;
    didMutate = true;
  } else {
    rootId = root.id;
    if (canUpdateRootFavicon && normalizedFavicon !== root.data.favicon) {
      root.data.favicon = normalizedFavicon as FaviconUrl;
      didMutate = true;
    }
  }

  tabManager.register(rootId, tab.id as TabId, registerOptions);
  if (isActiveTab) {
    tree.setCurrentById(rootId);
  }

  return {
    handled: true,
    rootId,
    didMutate,
    didUpdateCurrent: isActiveTab,
  };
}
