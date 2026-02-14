import { BACKEND_CONFIG, buildBackendUrl, initBackendConfig } from "../../shared/config/backend.js";
import { notifyUi } from "../messaging/ui-notifications.js";

const AUTH_STORAGE_KEY = "trail_auth_session" as const;
const DEVICE_ID_STORAGE_KEY = "trail_oauth_device_id" as const;
const SILENT_SYNC_DEBOUNCE_MS = 1000;
const ACCESS_TOKEN_EARLY_REFRESH_MS = 30_000;
const LOGIN_REQUIRED_COOLDOWN_MS = 5_000;
const LOGIN_NEXT_PATH = "/trails";

type StoredAuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
};

type AuthSuccessReason = "authenticated" | "opened_login_tab";

type AuthFailureReason =
  | "login_required"
  | "refresh_invalid"
  | "network_error"
  | "state_mismatch"
  | "missing_code"
  | "token_exchange_failed"
  | "token_payload_invalid"
  | "open_login_tab_failed";

type AuthFlowResult =
  | { ok: true; reason: AuthSuccessReason }
  | { ok: false; reason: AuthFailureReason };

function logAuth(message: string, payload?: Record<string, unknown>): void {
  if (payload) {
    console.info("[auth-orchestrator]", message, payload);
    return;
  }
  console.info("[auth-orchestrator]", message);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function isAccessTokenExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return true;
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= Date.now() + ACCESS_TOKEN_EARLY_REFRESH_MS;
}

async function loadAuth(): Promise<StoredAuthSession | null> {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const auth = data[AUTH_STORAGE_KEY] as StoredAuthSession | undefined;
  return auth ?? null;
}

async function saveAuth(auth: StoredAuthSession | null): Promise<void> {
  if (!auth) {
    await chrome.storage.local.remove(AUTH_STORAGE_KEY);
    return;
  }
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
}

async function getOrCreateDeviceId(): Promise<string> {
  const data = await chrome.storage.local.get(DEVICE_ID_STORAGE_KEY);
  const existing = data[DEVICE_ID_STORAGE_KEY];
  if (typeof existing === "string" && existing.trim()) {
    return existing;
  }

  const next = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await chrome.storage.local.set({ [DEVICE_ID_STORAGE_KEY]: next });
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

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
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

async function runSilentAuthorizeFlow(): Promise<AuthFlowResult> {
  await initBackendConfig();
  const clientId = "trail-extension";
  const deviceId = await getOrCreateDeviceId();
  const redirectUri = chrome.identity.getRedirectURL("oauth-callback");
  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const authorizeUrl = new URL(buildBackendUrl(BACKEND_CONFIG.endpoints.oauthAuthorize));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "trail.extension");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("prompt", "none");
  authorizeUrl.searchParams.set("device_id", deviceId);

  let callbackUrl: string | undefined;
  try {
    callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: authorizeUrl.toString(),
      interactive: false,
    });
  } catch {
    return { ok: false, reason: "login_required" };
  }

  if (!callbackUrl) {
    return { ok: false, reason: "login_required" };
  }

  const callback = new URL(callbackUrl);
  const callbackState = callback.searchParams.get("state") ?? "";
  if (callbackState !== state) {
    return { ok: false, reason: "state_mismatch" };
  }

  const error = callback.searchParams.get("error");
  if (error) {
    if (error === "login_required") {
      return { ok: false, reason: "login_required" };
    }
    return { ok: false, reason: "token_exchange_failed" };
  }

  const code = callback.searchParams.get("code") ?? "";
  if (!code) {
    return { ok: false, reason: "missing_code" };
  }

  return exchangeAuthorizationCode({
    code,
    codeVerifier,
    redirectUri,
    clientId,
    deviceId,
  });
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

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
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

  private async clearAuth(reason: "web_logout" | "login_required" | "refresh_invalid"): Promise<void> {
    await saveAuth(null);
    if (reason === "login_required") {
      this.markLoginRequiredCooldown();
    } else {
      this.clearLoginRequiredCooldown();
    }
    logAuth("auth_cleared", { reason });
  }

  async invalidateFromWebLogout(): Promise<void> {
    await this.clearAuth("web_logout");
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    chrome.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId !== 0 || !details.url) {
        return;
      }
      try {
        const origin = new URL(details.url).origin;
        if (
          origin === "https://app.gettrail.net" ||
          origin === "https://gettrail.net" ||
          origin === "http://localhost:3000" ||
          origin === "http://localhost:3001" ||
          origin === "http://127.0.0.1:3000" ||
          origin === "http://127.0.0.1:3001"
        ) {
          this.scheduleSilentSync();
        }
      } catch {
        // ignore malformed URL
      }
    });

    if (chrome.cookies?.onChanged) {
      chrome.cookies.onChanged.addListener((changeInfo) => {
        if (
          changeInfo.cookie.name === "trail_auth_session" ||
          changeInfo.cookie.name === "better-auth.session_token" ||
          changeInfo.cookie.name === "__Secure-better-auth.session_token"
        ) {
          this.clearLoginRequiredCooldown();
          this.scheduleSilentSync({ force: true });
        }
      });
    }

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
    const loginUrl = new URL("/auth/login", BACKEND_CONFIG.baseUrl);
    loginUrl.searchParams.set("next", LOGIN_NEXT_PATH);
    loginUrl.searchParams.set("prompt", "select_account");
    loginUrl.searchParams.set("maxAge", "0");

    try {
      await chrome.tabs.create({ url: loginUrl.toString(), active: true });
      logAuth("opened_login_tab", { url: loginUrl.toString() });
      this.clearLoginRequiredCooldown();
      this.scheduleSilentSync({ force: true });
      return true;
    } catch {
      return false;
    }
  }

  private async executeSilentSync(input: {
    skipCooldown?: boolean;
  } = {}): Promise<AuthFlowResult> {
    if (!input.skipCooldown && this.isCooldownActive()) {
      return { ok: false, reason: "login_required" };
    }

    const auth = await loadAuth();
    if (auth?.accessToken && !isAccessTokenExpired(auth.expiresAt)) {
      return { ok: true, reason: "authenticated" };
    }

    if (auth?.refreshToken && isAccessTokenExpired(auth.expiresAt)) {
      const refreshed = await refreshWithToken(auth.refreshToken);
      if (refreshed.ok) {
        this.clearLoginRequiredCooldown();
        return refreshed;
      }
      if (refreshed.reason === "refresh_invalid") {
        await this.clearAuth("refresh_invalid");
      }
      return refreshed;
    }

    const result = await runSilentAuthorizeFlow();
    if (result.ok) {
      this.clearLoginRequiredCooldown();
      return result;
    }
    if (result.reason === "login_required") {
      await this.clearAuth("login_required");
    }
    return result;
  }

  async interactiveLogin(): Promise<AuthFlowResult> {
    return this.runSingleFlight(async () => {
      const result = await this.executeSilentSync({ skipCooldown: true });
      if (result.ok) {
        logAuth("interactive_login_silent_success");
        return result;
      }

      if (
        result.reason !== "login_required" &&
        result.reason !== "refresh_invalid"
      ) {
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
}

export const authOrchestrator = new AuthOrchestrator();
