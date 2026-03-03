import { browser, type Browser } from 'wxt/browser';

export { browser };
export type { Browser };

export type RuntimeMessageSender = Browser.runtime.MessageSender;
export type RuntimePort = Browser.runtime.Port;
export type Tab = Browser.tabs.Tab;

export type SidebarMode = 'sidePanel' | 'sidebarAction' | 'unavailable';

// Firefox sidebarAction is not part of @wxt-dev/browser typings (Chrome-derived).
type BrowserWithSidebarAction = typeof browser & {
  sidebarAction?: {
    open?: () => Promise<void> | void;
  };
};

type BrowserWithSidePanel = typeof browser & {
  sidePanel?: {
    setOptions?: (options: { tabId?: number; enabled?: boolean; path?: string }) => Promise<void> | void;
    open?: (options: { tabId?: number }) => Promise<void> | void;
  };
};

type BrowserWithRuntimeGetURL = typeof browser & {
  runtime?: {
    getURL?: (path: string) => string;
  };
};

function resolveRuntimeGetURL():
  | ((path: string) => string)
  | null {
  const getURL = (browser as BrowserWithRuntimeGetURL).runtime?.getURL;
  return typeof getURL === 'function' ? getURL : null;
}

export function hasRuntimeGetURL(): boolean {
  return resolveRuntimeGetURL() !== null;
}

export function runtimeGetURL(path: string): string {
  const getURL = resolveRuntimeGetURL();
  if (!getURL) {
    throw new Error('runtime.getURL is unavailable');
  }
  return getURL(path);
}

export async function openSidebarForTab(tabId: number): Promise<{ mode: SidebarMode }> {
  const sidePanel = (browser as BrowserWithSidePanel).sidePanel;
  if (sidePanel?.open) {
    if (sidePanel.setOptions) {
      await sidePanel.setOptions({ tabId, enabled: true, path: 'sidepanel.html' });
    }
    await sidePanel.open({ tabId });
    return { mode: 'sidePanel' };
  }

  const sidebarAction = (browser as BrowserWithSidebarAction).sidebarAction;
  if (typeof sidebarAction?.open === 'function') {
    await sidebarAction.open();
    return { mode: 'sidebarAction' };
  }

  return { mode: 'unavailable' };
}
