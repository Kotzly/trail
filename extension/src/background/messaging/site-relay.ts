import { isAllowedSiteOrigin } from "../../shared/config/site-origins.js";

async function relayToAllowedSiteTabs(
  payload: Record<string, unknown>,
): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined || !tab.url) {
        return;
      }

      let origin: string;
      try {
        origin = new URL(tab.url).origin;
      } catch {
        return;
      }

      if (!isAllowedSiteOrigin(origin)) {
        return;
      }

      await chrome.tabs
        .sendMessage(tab.id, {
          type: "RELAY_TO_SITE",
          payload,
        })
        .catch(() => undefined);
    }),
  );
}

export async function broadcastAuthRevokedToSiteTabs(): Promise<void> {
  await relayToAllowedSiteTabs({
    source: "trail-extension",
    type: "AUTH_REVOKED",
    timestamp: Date.now(),
  });
}
