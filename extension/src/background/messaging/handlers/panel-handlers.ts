import { RPC_METHOD, defineRpcHandlers, err, ok } from "@shared/rpc/contracts.js";
import { browser, openSidebarForTab, type RuntimePort } from "@shared/platform/webext.js";

/* ------------------------------------------------------------------ */
/*  Sidepanel liveness tracking via persistent Port                    */
/* ------------------------------------------------------------------ */

let sidepanelPort: RuntimePort | null = null;

browser.runtime.onConnect.addListener((port) => {
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

export const panelHandlers = defineRpcHandlers({
  async [RPC_METHOD.OPEN_PANEL](_message, sender) {
    const tabId = sender.tab?.id;
    if (!tabId) return err("No tab ID");

    try {
      const result = await openSidebarForTab(tabId);
      if (result.mode === "unavailable") {
        return err("Sidebar API unavailable");
      }
      return ok();
    } catch (error) {
      console.warn("OPEN_PANEL failed", { tabId, error });
      const message = error instanceof Error ? error.message : "Failed to open side panel";
      if (message.toLowerCase().includes("already open")) return ok();
      return err(message);
    }
  },
});
