import { isAllowedSiteOrigin } from "../../shared/config/site-origins.js";

type WebBridgeCode = {
  code: string;
  expiresAt: string;
};

const ACCOUNT_ORIGINS = new Set<string>([
  "https://app.gettrail.net",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTabOrigin(tab: chrome.tabs.Tab): string | null {
  if (!tab.url) {
    return null;
  }
  try {
    return new URL(tab.url).origin;
  } catch {
    return null;
  }
}

function scoreTab(tab: chrome.tabs.Tab, origin: string): number {
  let score = 0;
  if (ACCOUNT_ORIGINS.has(origin)) {
    score += 100;
  }
  if (tab.active) {
    score += 10;
  }
  return score;
}

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

function parseWebBridgePayload(
  value: unknown,
  requestId: string,
): WebBridgeCode | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.source !== "trail-site" || value.type !== "WEB_AUTH_BRIDGE_CODE") {
    return null;
  }
  if (value.requestId !== requestId || value.ok !== true) {
    return null;
  }
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const expiresAt =
    typeof value.expiresAt === "string" ? value.expiresAt.trim() : "";
  if (!code || !expiresAt) {
    return null;
  }
  return { code, expiresAt };
}

async function requestWebBridgeCodeFromTab(
  tabId: number,
  timeoutMs: number,
): Promise<WebBridgeCode | null> {
  const requestId = createRequestId();
  const response = await chrome.tabs
    .sendMessage(tabId, {
      type: "RELAY_TO_SITE",
      payload: {
        source: "trail-extension",
        type: "REQUEST_WEB_AUTH_BRIDGE_CODE",
        requestId,
        timestamp: Date.now(),
      },
      expectResponseType: "WEB_AUTH_BRIDGE_CODE",
      timeoutMs,
    })
    .catch(() => null);

  if (!isRecord(response) || response.success !== true) {
    return null;
  }

  const data = isRecord(response.data) ? response.data : null;
  const responsePayload = data?.responsePayload;
  return parseWebBridgePayload(responsePayload, requestId);
}

export async function requestWebAuthBridgeCodeFromSiteTabs(): Promise<WebBridgeCode | null> {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs
    .map((tab) => {
      const origin = toTabOrigin(tab);
      if (!origin || !isAllowedSiteOrigin(origin) || tab.id === undefined) {
        return null;
      }
      return {
        tabId: tab.id,
        score: scoreTab(tab, origin),
      };
    })
    .filter((value): value is { tabId: number; score: number } => Boolean(value))
    .sort((left, right) => right.score - left.score);

  for (const candidate of candidates) {
    const code = await requestWebBridgeCodeFromTab(candidate.tabId, 1_500);
    if (code) {
      return code;
    }
  }

  return null;
}
