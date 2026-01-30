import { MSG, defineHandlers, err, ok } from "../../../shared/types/messages.js";

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
  const maybePromise = setOptions({ tabId, enabled: true } as any);
  if (isPromiseLike<void>(maybePromise)) {
    await maybePromise;
    return;
  }
  await promisifyChromeCall<void>((cb) => setOptions({ tabId, enabled: true }, cb));
}

async function enableAndOpenSidePanel(tabId: number): Promise<void> {
  if (!chrome.sidePanel?.open) throw new Error("Side panel API unavailable");

  const openPromise = openSidePanel(tabId);

  // Enable in the background so we don't insert an async gap before open().
  void enableSidePanel(tabId).catch((error) => {
    console.warn("Failed to enable side panel", { tabId, error });
  });

  await openPromise;
}

export const panelHandlers = defineHandlers({
  async [MSG.OPEN_PANEL](_message, sender) {
    const tabId = sender.tab?.id;
    if (!tabId) return err("No tab ID");

    try {
      await enableAndOpenSidePanel(tabId);
      return ok();
    } catch (error) {
      console.warn("OPEN_PANEL failed", { tabId, error });
      return err(error instanceof Error ? error.message : "Failed to open side panel");
    }
  },
});
