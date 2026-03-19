import { BACKEND_CONFIG, buildBackendUrl, initBackendConfig } from "../../shared/config/backend.js";
import { authPolicyItem, type CachedAuthPolicy } from "../../shared/config/storage-items.js";

const POLICY_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

const DEFAULT_POLICY: CachedAuthPolicy = {
  authRequired: false,
  fetchedAt: 0,
};

type SessionStateResponse = {
  status: string;
  config?: Record<string, unknown>;
};

async function fetchSessionState(): Promise<SessionStateResponse | null> {
  await initBackendConfig();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);

  try {
    const response = await fetch(buildBackendUrl(BACKEND_CONFIG.endpoints.authSessionState), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as Record<string, unknown>).status !== "string"
    ) {
      throw new Error("Invalid session state response");
    }
    return parsed as SessionStateResponse;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

class AuthPolicyKeeper {
  private inFlight: Promise<CachedAuthPolicy> | null = null;

  async getPolicy(): Promise<CachedAuthPolicy> {
    const cached = await authPolicyItem.getValue();
    if (cached && Date.now() - cached.fetchedAt < POLICY_CACHE_MAX_AGE_MS) {
      return cached;
    }
    return this.refreshPolicy(cached);
  }

  async refreshPolicy(fallback?: CachedAuthPolicy | null): Promise<CachedAuthPolicy> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async (): Promise<CachedAuthPolicy> => {
      try {
        const data = await fetchSessionState();
        const authRequired =
          typeof data?.config?.["auth.extension.required"] === "boolean"
            ? (data.config["auth.extension.required"] as boolean)
            : false;

        const policy: CachedAuthPolicy = {
          authRequired,
          fetchedAt: Date.now(),
        };
        await authPolicyItem.setValue(policy);
        return policy;
      } catch (e) {
        console.warn("[auth-policy] Policy check failed:", String(e));
        return fallback ?? DEFAULT_POLICY;
      }
    })();

    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  async invalidate(): Promise<void> {
    await authPolicyItem.removeValue();
  }
}

export const authPolicyKeeper = new AuthPolicyKeeper();
