// Replacement for @shared/platform/webext.js — mirrors exported surface but
// points at the preview chrome shim installed in chrome-shim.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBrowser = any;

export const browser: AnyBrowser = (globalThis as unknown as { chrome: AnyBrowser }).chrome;

export type Browser = AnyBrowser;
export type RuntimeMessageSender = Record<string, unknown>;
export type RuntimePort = { name: string; postMessage: (msg: unknown) => void };
export type Tab = {
  id?: number;
  title?: string;
  url?: string;
  mutedInfo?: { muted?: boolean; reason?: "user" | "capture" | "extension" };
};

export type SidebarMode = "sidePanel" | "sidebarAction" | "unavailable";

export function hasRuntimeGetURL(): boolean {
  return true;
}

export function runtimeGetURL(path: string): string {
  return browser.runtime.getURL(path);
}

export async function openSidebarForTab(): Promise<{ mode: SidebarMode }> {
  return { mode: "sidePanel" };
}
