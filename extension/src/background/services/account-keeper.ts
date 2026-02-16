import type { AccountSnapshot, Plan } from "../../shared/types/account.js";
import {
  BACKEND_CONFIG,
  buildBackendUrl,
  initBackendConfig,
} from "../../shared/config/backend.js";

const SNAPSHOT_CACHE_KEY = "trail_account_snapshot";
const AUTH_STORAGE_KEY = "trail_auth_session";
const ALARM_NAME = "trail_account_snapshot_refresh";
const REFRESH_INTERVAL_MINUTES = 5;

type StoredAuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
};

type CachedSnapshotEnvelope = {
  snapshot: AccountSnapshot;
  fetchedAt: number;
};

function log(message: string, payload?: Record<string, unknown>): void {
  if (payload) {
    console.info("[account-keeper]", message, payload);
    return;
  }
  console.info("[account-keeper]", message);
}

async function loadAuth(): Promise<StoredAuthSession | null> {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const auth = data[AUTH_STORAGE_KEY] as StoredAuthSession | undefined;
  return auth ?? null;
}

function buildGuestSnapshot(plans: Plan[] = []): AccountSnapshot {
  return {
    session: { status: "guest" },
    user: null,
    subscription: null,
    billing: { state: "none" },
    plans,
    config: {},
    onboarding: { flowId: "activation-v1", status: "pending", seenAt: null },
  };
}

async function fetchJson<T>(
  path: string,
  options: { auth?: boolean } = {},
): Promise<T> {
  await initBackendConfig();
  const headers = new Headers({ Accept: "application/json" });

  if (options.auth !== false) {
    const auth = await loadAuth();
    if (auth?.accessToken) {
      headers.set("Authorization", `Bearer ${auth.accessToken}`);
    }
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    BACKEND_CONFIG.timeoutMs,
  );

  try {
    const response = await fetch(buildBackendUrl(path), {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function fetchSnapshot(): Promise<AccountSnapshot> {
  const auth = await loadAuth();
  if (!auth?.accessToken) {
    const plans = await fetchJson<Plan[]>(
      BACKEND_CONFIG.endpoints.plans,
      { auth: false },
    ).catch(() => []);
    return buildGuestSnapshot(plans);
  }

  try {
    const snapshot = await fetchJson<AccountSnapshot>(
      BACKEND_CONFIG.endpoints.account,
    );
    if (!snapshot.plans || snapshot.plans.length === 0) {
      const plans = await fetchJson<Plan[]>(
        BACKEND_CONFIG.endpoints.plans,
        { auth: false },
      ).catch(() => []);
      return { ...snapshot, plans };
    }
    return snapshot;
  } catch {
    const plans = await fetchJson<Plan[]>(
      BACKEND_CONFIG.endpoints.plans,
      { auth: false },
    ).catch(() => []);
    return buildGuestSnapshot(plans);
  }
}

async function saveToStorage(envelope: CachedSnapshotEnvelope): Promise<void> {
  await chrome.storage.local.set({ [SNAPSHOT_CACHE_KEY]: envelope });
}

class AccountKeeper {
  private initialized = false;
  private inFlight: Promise<void> | null = null;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        void this.refreshSnapshot();
      }
    });

    void chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: REFRESH_INTERVAL_MINUTES,
    });

    void this.refreshSnapshot();
  }

  async refreshSnapshot(): Promise<void> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const snapshot = await fetchSnapshot();
        const envelope: CachedSnapshotEnvelope = {
          snapshot,
          fetchedAt: Date.now(),
        };
        await saveToStorage(envelope);
        log("snapshot_cached");
      } catch (error) {
        log("snapshot_cache_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  async getCachedSnapshot(): Promise<AccountSnapshot | null> {
    const result = await chrome.storage.local.get(SNAPSHOT_CACHE_KEY);
    const envelope = result[SNAPSHOT_CACHE_KEY] as CachedSnapshotEnvelope | undefined;
    return envelope?.snapshot ?? null;
  }

  async clearSnapshot(): Promise<void> {
    const guest = buildGuestSnapshot();
    const envelope: CachedSnapshotEnvelope = {
      snapshot: guest,
      fetchedAt: Date.now(),
    };
    await saveToStorage(envelope);
    log("snapshot_cleared_to_guest");
  }
}

export const accountKeeper = new AccountKeeper();
