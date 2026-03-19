import type { AccountConfig, AccountSnapshot, Plan } from "@shared/types/account.js";
import { browser } from "@shared/platform/webext.js";
import { BACKEND_CONFIG, buildBackendUrl, initBackendConfig } from "../../shared/config/backend.js";
import {
  authSessionItem,
  authPolicyItem,
  accountSnapshotItem,
  type StoredAuthSession,
  type CachedSnapshotEnvelope,
} from "../../shared/config/storage-items.js";
import { authPolicyKeeper } from "./auth-policy-keeper.js";

const ALARM_NAME = "trail_account_snapshot_refresh";
const REFRESH_INTERVAL_MINUTES = 5;

function log(_message: string, _payload?: Record<string, unknown>): void {
  // Intentionally silent in production. Enable for local debugging:
  // console.info("[account-keeper]", _message, _payload);
}

async function loadAuth(): Promise<StoredAuthSession | null> {
  return authSessionItem.getValue();
}

function buildGuestSnapshot(plans: Plan[] = [], config: AccountConfig = {}): AccountSnapshot {
  return {
    session: { status: "guest" },
    user: null,
    subscription: null,
    billing: { state: "none" },
    plans,
    config,
    onboarding: { flowId: "activation-v1", status: "pending", seenAt: null },
  };
}

async function fetchJson<T>(
  path: string,
  options: { auth?: boolean; validate?: (data: unknown) => data is T } = {},
): Promise<T | null> {
  await initBackendConfig();
  const headers = new Headers({ Accept: "application/json" });

  if (options.auth !== false) {
    const auth = await loadAuth();
    if (auth?.accessToken) {
      headers.set("Authorization", `Bearer ${auth.accessToken}`);
    }
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);

  try {
    const response = await fetch(buildBackendUrl(path), {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error(`Expected JSON object/array, got ${typeof parsed}`);
    }
    if (options.validate && !options.validate(parsed)) {
      throw new Error(`Response failed validation for ${path}`);
    }
    return parsed as T;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function fetchSnapshot(): Promise<AccountSnapshot> {
  const auth = await loadAuth();
  if (!auth?.accessToken) {
    const [plans, policy] = await Promise.all([
      fetchJson<Plan[]>(BACKEND_CONFIG.endpoints.plans, { auth: false }).catch(() => null),
      authPolicyKeeper.getPolicy(),
    ]);
    return buildGuestSnapshot(plans ?? [], {
      "auth.extension.required": policy.authRequired,
    });
  }

  try {
    const snapshot = await fetchJson<AccountSnapshot>(BACKEND_CONFIG.endpoints.account);
    if (!snapshot) throw new Error("empty account response");
    if (!snapshot.plans || snapshot.plans.length === 0) {
      const plans = await fetchJson<Plan[]>(BACKEND_CONFIG.endpoints.plans, { auth: false }).catch(
        () => null,
      );
      return { ...snapshot, plans: plans ?? [] };
    }
    return snapshot;
  } catch {
    // Propagate the error so refreshSnapshot() does NOT overwrite the
    // cached authenticated snapshot with a guest one. Transient failures
    // (network, 401 with valid refresh token) should not flash the auth gate.
    throw new Error("snapshot fetch failed");
  }
}

async function saveToStorage(envelope: CachedSnapshotEnvelope): Promise<void> {
  await accountSnapshotItem.setValue(envelope);
}

class AccountKeeper {
  private initialized = false;
  private inFlight: Promise<void> | null = null;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        void this.refreshSnapshot();
      }
    });

    void browser.alarms.create(ALARM_NAME, {
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
    const envelope = await accountSnapshotItem.getValue();
    return envelope?.snapshot ?? null;
  }

  async clearSnapshot(): Promise<void> {
    const policy = await authPolicyItem.getValue();
    const guest = buildGuestSnapshot([], {
      "auth.extension.required": policy?.authRequired ?? false,
    });
    const envelope: CachedSnapshotEnvelope = {
      snapshot: guest,
      fetchedAt: Date.now(),
    };
    await saveToStorage(envelope);
    log("snapshot_cleared_to_guest");
  }
}

export const accountKeeper = new AccountKeeper();
