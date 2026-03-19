import { BACKEND_CONFIG, buildBackendUrl, initBackendConfig } from "@shared/config/backend.js";
import { isAllowedSiteOrigin } from "@shared/config/site-origins.js";
import {
  authSessionItem,
  oauthDeviceIdItem,
  type StoredAuthSession,
} from "../../shared/config/storage-items.js";
import { notifyUi } from "../messaging/ui-notifications.js";
import { syncEngine } from "./sync/engine.js";
import { accountKeeper } from "./account-keeper.js";
import { authPolicyKeeper } from "./auth-policy-keeper.js";
import { browser } from "@shared/platform/webext.js";

const AUTH_REFRESH_ALARM = "trail-auth-refresh" as const;
const AUTH_REFRESH_INTERVAL_MINUTES = 2;
const SILENT_SYNC_DEBOUNCE_MS = 1000;
const ACCESS_TOKEN_EARLY_REFRESH_MS = 30_000;
const LOGIN_REQUIRED_COOLDOWN_MS = 5_000;
const LOGIN_NEXT_PATH = "/trails";

type AuthSuccessReason = "authenticated" | "opened_login_tab";

type AuthFailureReason =
  | "login_required"
  | "refresh_invalid"
  | "network_error"
  | "token_exchange_failed"
  | "token_payload_invalid"
  | "open_login_tab_failed";

type AuthFlowResult =
  | { ok: true; reason: AuthSuccessReason }
  | { ok: false; reason: AuthFailureReason };

function logAuth(_message: string, _payload?: Record<string, unknown>): void {
  // Intentionally silent in production. Enable for local debugging:
  // console.info("[auth-orchestrator]", _message, _payload);
}

function isAccessTokenExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return true;
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= Date.now() + ACCESS_TOKEN_EARLY_REFRESH_MS;
}

async function loadAuth(): Promise<StoredAuthSession | null> {
  return authSessionItem.getValue();
}

async function saveAuth(auth: StoredAuthSession | null): Promise<void> {
  if (!auth) {
    await authSessionItem.removeValue();
    return;
  }
  await authSessionItem.setValue(auth);
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await oauthDeviceIdItem.getValue();
  if (typeof existing === "string" && existing.trim()) {
    return existing;
  }

  const next =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await oauthDeviceIdItem.setValue(next);
  return next;
}

async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  deviceId: string;
}): Promise<AuthFlowResult> {
  await initBackendConfig();
  const response = await fetch(buildBackendUrl(BACKEND_CONFIG.endpoints.oauthToken), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      device_id: input.deviceId,
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      ok: false,
      reason: response ? "token_exchange_failed" : "network_error",
    };
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
  const refreshToken = typeof payload?.refresh_token === "string" ? payload.refresh_token : "";
  const expiresAt = typeof payload?.expires_at === "string" ? payload.expires_at : "";

  if (!accessToken || !refreshToken || !expiresAt) {
    return { ok: false, reason: "token_payload_invalid" };
  }

  await saveAuth({
    accessToken,
    refreshToken,
    expiresAt,
  });
  return { ok: true, reason: "authenticated" };
}

async function refreshWithToken(refreshToken: string): Promise<AuthFlowResult> {
  await initBackendConfig();
  const response = await fetch(buildBackendUrl(BACKEND_CONFIG.endpoints.oauthToken), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: "trail-extension",
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      ok: false,
      reason: response ? "refresh_invalid" : "network_error",
    };
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
  const nextRefreshToken = typeof payload?.refresh_token === "string" ? payload.refresh_token : "";
  const expiresAt = typeof payload?.expires_at === "string" ? payload.expires_at : "";

  if (!accessToken || !nextRefreshToken || !expiresAt) {
    return { ok: false, reason: "refresh_invalid" };
  }

  await saveAuth({
    accessToken,
    refreshToken: nextRefreshToken,
    expiresAt,
  });
  return { ok: true, reason: "authenticated" };
}

class AuthOrchestrator {
  private initialized = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<AuthFlowResult> | null = null;
  private loginRequiredCooldownUntil = 0;

  private isCooldownActive(): boolean {
    return Date.now() < this.loginRequiredCooldownUntil;
  }

  private markLoginRequiredCooldown(): void {
    this.loginRequiredCooldownUntil = Date.now() + LOGIN_REQUIRED_COOLDOWN_MS;
  }

  private clearLoginRequiredCooldown(): void {
    this.loginRequiredCooldownUntil = 0;
  }

  private async clearAuth(
    reason: "web_logout" | "login_required" | "refresh_invalid",
  ): Promise<void> {
    await saveAuth(null);
    if (reason === "login_required") {
      this.markLoginRequiredCooldown();
    } else {
      this.clearLoginRequiredCooldown();
    }
    logAuth("auth_cleared", { reason });

    void authPolicyKeeper.invalidate();
    await accountKeeper.clearSnapshot();

    // On explicit logout, clear all local trees so the next login
    // pulls a fresh set for the (possibly different) account.
    if (reason === "web_logout") {
      await syncEngine.resetForAccountSwitch();
    }
  }

  async invalidateFromWebLogout(): Promise<void> {
    await this.clearAuth("web_logout");
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === AUTH_REFRESH_ALARM) {
        void this.silentSync();
      }
    });

    void browser.alarms.create(AUTH_REFRESH_ALARM, {
      periodInMinutes: AUTH_REFRESH_INTERVAL_MINUTES,
    });

    browser.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId !== 0 || !details.url) {
        return;
      }
      try {
        const origin = new URL(details.url).origin;
        if (isAllowedSiteOrigin(origin)) {
          this.scheduleSilentSync();
        }
      } catch {
        // ignore malformed URL
      }
    });

    this.scheduleSilentSync();
  }

  scheduleSilentSync(options: { force?: boolean } = {}): void {
    if (!options.force && this.isCooldownActive()) {
      return;
    }

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.silentSync();
    }, SILENT_SYNC_DEBOUNCE_MS);
  }

  private async runSingleFlight(fn: () => Promise<AuthFlowResult>): Promise<AuthFlowResult> {
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = fn().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async openWebsiteLoginTab(): Promise<boolean> {
    await initBackendConfig();
    const callbackUrl = new URL("/auth/callback", BACKEND_CONFIG.baseUrl);
    callbackUrl.searchParams.set("next", LOGIN_NEXT_PATH);
    callbackUrl.searchParams.set("source", "extension");

    try {
      await browser.tabs.create({ url: callbackUrl.toString(), active: true });
      logAuth("opened_login_tab", { url: callbackUrl.toString() });
      this.clearLoginRequiredCooldown();
      this.scheduleSilentSync({ force: true });
      return true;
    } catch {
      return false;
    }
  }

  private async executeSilentSync(
    input: {
      skipCooldown?: boolean;
    } = {},
  ): Promise<AuthFlowResult> {
    if (!input.skipCooldown && this.isCooldownActive()) {
      return { ok: false, reason: "login_required" };
    }

    const auth = await loadAuth();
    if (auth?.accessToken && !isAccessTokenExpired(auth.expiresAt)) {
      void accountKeeper.refreshSnapshot();
      return { ok: true, reason: "authenticated" };
    }

    if (auth?.refreshToken && isAccessTokenExpired(auth.expiresAt)) {
      const refreshed = await refreshWithToken(auth.refreshToken);
      if (refreshed.ok) {
        this.clearLoginRequiredCooldown();
        void authPolicyKeeper.invalidate();
        void accountKeeper.refreshSnapshot();
        return refreshed;
      }
      if (refreshed.reason === "refresh_invalid") {
        await this.clearAuth("refresh_invalid");
      }
      return refreshed;
    }

    // No stored tokens — user must sign in via the website.
    // The site will relay an auth code through the content script
    // (AUTH_CODE_RELAY), which is handled by handleAuthCodeRelay().
    return { ok: false, reason: "login_required" };
  }

  async interactiveLogin(): Promise<AuthFlowResult> {
    return this.runSingleFlight(async () => {
      const result = await this.executeSilentSync({ skipCooldown: true });
      if (result.ok) {
        logAuth("interactive_login_silent_success");
        return result;
      }

      if (result.reason !== "login_required" && result.reason !== "refresh_invalid") {
        notifyUi({
          message: "Sign-in failed. Please try again.",
          icon: "AlertTriangle",
          durationMs: 4500,
        });
        logAuth("interactive_login_failed", { reason: result.reason });
        return result;
      }

      const opened = await this.openWebsiteLoginTab();
      if (!opened) {
        notifyUi({
          message: "Couldn't open sign-in tab. Please try again.",
          icon: "AlertTriangle",
          durationMs: 4500,
        });
        return { ok: false, reason: "open_login_tab_failed" };
      }

      return { ok: true, reason: "opened_login_tab" };
    });
  }

  async silentSync(): Promise<AuthFlowResult> {
    return this.runSingleFlight(() => this.executeSilentSync());
  }

  async handleAuthCodeRelay(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<AuthFlowResult> {
    return this.runSingleFlight(async () => {
      const clientId = "trail-extension";
      const deviceId = await getOrCreateDeviceId();
      const result = await exchangeAuthorizationCode({
        code: input.code,
        codeVerifier: input.codeVerifier,
        redirectUri: input.redirectUri,
        clientId,
        deviceId,
      });

      if (result.ok) {
        this.clearLoginRequiredCooldown();
        void authPolicyKeeper.invalidate();
        void accountKeeper.refreshSnapshot();
        logAuth("auth_code_relay_success");
      } else {
        logAuth("auth_code_relay_failed", { reason: result.reason });
      }

      return result;
    });
  }
}

export const authOrchestrator = new AuthOrchestrator();
