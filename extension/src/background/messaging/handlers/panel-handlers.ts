import { RPC_METHOD, defineRpcHandlers, err, ok } from "../../../shared/rpc/contracts.js";

const SIDE_PANEL_PATH = "sidepanel.html";

/* ------------------------------------------------------------------ */
/*  Sidepanel liveness tracking via persistent Port                    */
/* ------------------------------------------------------------------ */

let sidepanelPort: chrome.runtime.Port | null = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sidepanel") return;
  sidepanelPort = port;
  port.onDisconnect.addListener(() => {
    sidepanelPort = null;
  });
});

/** True when the sidepanel JS context is alive (port connected). */
export function isSidepanelAlive(): boolean {
  return sidepanelPort !== null;
}

/* ------------------------------------------------------------------ */

function promisifyChromeCall<T>(fn: (cb: (result?: T) => void) => void): Promise<T | void> {
  return new Promise((resolve, reject) => {
    try {
      fn((result?: T) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) return reject(new Error(lastErr.message));
        resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value) && typeof (value as PromiseLike<T>).then === "function";
}

async function openSidePanel(tabId: number): Promise<void> {
  // Call open immediately to preserve the user gesture chain.
  const maybePromise = chrome.sidePanel.open({ tabId } as any);
  if (isPromiseLike<void>(maybePromise)) {
    await maybePromise;
    return;
  }
  await promisifyChromeCall<void>((cb) => (chrome.sidePanel.open as any)({ tabId }, cb));
}

async function enableSidePanel(tabId: number): Promise<void> {
  const setOptions = (chrome.sidePanel as any)?.setOptions;
  if (typeof setOptions !== "function") return;
  const options = { tabId, enabled: true, path: SIDE_PANEL_PATH } as any;
  const maybePromise = setOptions(options);
  if (isPromiseLike<void>(maybePromise)) {
    await maybePromise;
    return;
  }
  await promisifyChromeCall<void>((cb) => setOptions(options, cb));
}

async function enableAndOpenSidePanel(tabId: number): Promise<void> {
  if (!chrome.sidePanel?.open) throw new Error("Side panel API unavailable");

  const enablePromise = enableSidePanel(tabId);

  try {
    await openSidePanel(tabId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("No active side panel")) throw error;
    await enablePromise;
    await openSidePanel(tabId);
  }
}

export const panelHandlers = defineRpcHandlers({
  async [RPC_METHOD.OPEN_PANEL](_message, sender) {
    const tabId = sender.tab?.id;
    if (!tabId) return err("No tab ID");

    try {
      await enableAndOpenSidePanel(tabId);
      return ok();
    } catch (error) {
      console.warn("OPEN_PANEL failed", { tabId, error });
      const message = error instanceof Error ? error.message : "Failed to open side panel";
      if (message.toLowerCase().includes("already open")) return ok();
      return err(message);
    }
  },
});
