export type BackendEnvironment = 'production' | 'staging' | 'local';
export type BackendMode = 'remote' | 'mock';
export type BackendPresetTag = 'production' | 'gettrail' | 'local';
export type BackendServerPreset = 'gettrail' | 'local';

export type BackendEndpoints = {
  oauthAuthorize: string;
  oauthToken: string;
  oauthRevoke: string;
  authSessionState: string;
  logout: string;
  account: string;
  plans: string;
  subscription: string;
  billing: string;
  checkout: string;
  billingPortal: string;
  trailsSync: string;
  onboarding: string;
};

export type BackendConfig = {
  env: BackendEnvironment;
  mode: BackendMode;
  baseUrl: string;
  basePath: string;
  portalUrl: string;
  timeoutMs: number;
  endpoints: BackendEndpoints;
  openApiPath: string;
};

export type BackendConfigOverride = Partial<
  Omit<BackendConfig, 'endpoints'> & { endpoints: Partial<BackendEndpoints> }
>;

const BACKEND_CONFIG_STORAGE_KEY = 'trail_backend_config';
const BACKEND_PRESET_CONFIG_PATH = 'backend-preset.json';
const VALID_ENVS = new Set<BackendEnvironment>(['production', 'staging', 'local']);
const VALID_MODES = new Set<BackendMode>(['remote', 'mock']);
const VALID_PRESETS = new Set<BackendPresetTag>(['production', 'gettrail', 'local']);

export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  env: 'production',
  mode: 'remote',
  baseUrl: 'https://app.gettrail.net',
  basePath: '/api/v1',
  portalUrl: 'https://app.gettrail.net/login',
  timeoutMs: 10000,
  endpoints: {
    oauthAuthorize: '/oauth/authorize',
    oauthToken: '/oauth/token',
    oauthRevoke: '/oauth/revoke',
    authSessionState: '/auth/session-state',
    logout: '/auth/logout',
    account: '/account',
    plans: '/plans',
    subscription: '/subscription',
    billing: '/billing',
    checkout: '/subscription/checkout',
    billingPortal: '/billing/portal',
    trailsSync: '/trails/sync',
    onboarding: '/onboarding',
  },
  openApiPath: 'api/openapi.yml',
};

export const BACKEND_CONFIG: BackendConfig = {
  ...DEFAULT_BACKEND_CONFIG,
  endpoints: { ...DEFAULT_BACKEND_CONFIG.endpoints },
};

let initPromise: Promise<BackendConfig> | null = null;
let initialized = false;

function hasStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const next = value.trim();
  if (!next) return fallback;
  try {
    const parsed = new URL(next);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function normalizePath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const next = value.trim();
  if (!next) return fallback;
  return next.startsWith('/') ? next : `/${next}`;
}

function normalizeTimeout(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function normalizeEnv(value: unknown, fallback: BackendEnvironment): BackendEnvironment {
  if (typeof value !== 'string') return fallback;
  return VALID_ENVS.has(value as BackendEnvironment) ? (value as BackendEnvironment) : fallback;
}

function normalizeMode(value: unknown, fallback: BackendMode): BackendMode {
  if (typeof value !== 'string') return fallback;
  return VALID_MODES.has(value as BackendMode) ? (value as BackendMode) : fallback;
}

function normalizePresetTag(value: unknown): BackendPresetTag | null {
  if (typeof value !== 'string') return null;
  return VALID_PRESETS.has(value as BackendPresetTag) ? (value as BackendPresetTag) : null;
}

export function resolveBackendConfig(override?: BackendConfigOverride | null): BackendConfig {
  const base = DEFAULT_BACKEND_CONFIG;
  if (!override) {
    return {
      ...base,
      endpoints: { ...base.endpoints },
    };
  }

  const endpointsInput = isRecord(override.endpoints) ? override.endpoints : null;
  return {
    env: normalizeEnv(override.env, base.env),
    mode: normalizeMode(override.mode, base.mode),
    baseUrl: normalizeBaseUrl(override.baseUrl, base.baseUrl),
    basePath: normalizePath(override.basePath, base.basePath),
    portalUrl: normalizeBaseUrl(override.portalUrl, base.portalUrl),
    timeoutMs: normalizeTimeout(override.timeoutMs, base.timeoutMs),
    endpoints: {
      oauthAuthorize: normalizePath(
        endpointsInput?.oauthAuthorize,
        base.endpoints.oauthAuthorize,
      ),
      oauthToken: normalizePath(
        endpointsInput?.oauthToken,
        base.endpoints.oauthToken,
      ),
      oauthRevoke: normalizePath(
        endpointsInput?.oauthRevoke,
        base.endpoints.oauthRevoke,
      ),
      authSessionState: normalizePath(
        endpointsInput?.authSessionState,
        base.endpoints.authSessionState,
      ),
      logout: normalizePath(endpointsInput?.logout, base.endpoints.logout),
      account: normalizePath(endpointsInput?.account, base.endpoints.account),
      plans: normalizePath(endpointsInput?.plans, base.endpoints.plans),
      subscription: normalizePath(endpointsInput?.subscription, base.endpoints.subscription),
      billing: normalizePath(endpointsInput?.billing, base.endpoints.billing),
      checkout: normalizePath(endpointsInput?.checkout, base.endpoints.checkout),
      billingPortal: normalizePath(endpointsInput?.billingPortal, base.endpoints.billingPortal),
      trailsSync: normalizePath(endpointsInput?.trailsSync, base.endpoints.trailsSync),
      onboarding: normalizePath(endpointsInput?.onboarding, base.endpoints.onboarding),
    },
    openApiPath:
      typeof override.openApiPath === 'string' && override.openApiPath.trim()
        ? override.openApiPath
        : base.openApiPath,
  };
}

export function resolvePresetOverride(tag: string | null | undefined): BackendConfigOverride | null {
  const normalized = normalizePresetTag(tag);
  if (normalized === 'local') {
    return {
      env: 'local',
      mode: 'remote',
      baseUrl: 'http://localhost:3001',
      portalUrl: 'http://localhost:3001/login',
    };
  }
  return null;
}

function isLocalHostName(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function hasLocalBaseUrl(config: BackendConfig): boolean {
  try {
    const parsed = new URL(config.baseUrl);
    return isLocalHostName(parsed.hostname);
  } catch {
    return false;
  }
}

export function getBackendServerPreset(config: BackendConfig = BACKEND_CONFIG): BackendServerPreset {
  if (config.env === 'local' || hasLocalBaseUrl(config)) {
    return 'local';
  }
  return 'gettrail';
}

function mergeOverrides(
  base?: BackendConfigOverride | null,
  patch?: BackendConfigOverride | null,
): BackendConfigOverride | null {
  if (!base && !patch) return null;
  const baseEndpoints = isRecord(base?.endpoints)
    ? (base?.endpoints as Partial<BackendEndpoints>)
    : undefined;
  const patchEndpoints = isRecord(patch?.endpoints)
    ? (patch?.endpoints as Partial<BackendEndpoints>)
    : undefined;
  const merged: BackendConfigOverride = {};
  const env = patch?.env ?? base?.env;
  const mode = patch?.mode ?? base?.mode;
  const baseUrl = patch?.baseUrl ?? base?.baseUrl;
  const basePath = patch?.basePath ?? base?.basePath;
  const portalUrl = patch?.portalUrl ?? base?.portalUrl;
  const timeoutMs = patch?.timeoutMs ?? base?.timeoutMs;
  const openApiPath = patch?.openApiPath ?? base?.openApiPath;

  if (env !== undefined) merged.env = env;
  if (mode !== undefined) merged.mode = mode;
  if (baseUrl !== undefined) merged.baseUrl = baseUrl;
  if (basePath !== undefined) merged.basePath = basePath;
  if (portalUrl !== undefined) merged.portalUrl = portalUrl;
  if (timeoutMs !== undefined) merged.timeoutMs = timeoutMs;
  if (openApiPath !== undefined) merged.openApiPath = openApiPath;
  if (baseEndpoints || patchEndpoints) {
    merged.endpoints = {
      ...(baseEndpoints ?? {}),
      ...(patchEndpoints ?? {}),
    };
  }
  return merged;
}

function applyBackendConfig(next: BackendConfig): BackendConfig {
  BACKEND_CONFIG.env = next.env;
  BACKEND_CONFIG.mode = next.mode;
  BACKEND_CONFIG.baseUrl = next.baseUrl;
  BACKEND_CONFIG.basePath = next.basePath;
  BACKEND_CONFIG.portalUrl = next.portalUrl;
  BACKEND_CONFIG.timeoutMs = next.timeoutMs;
  BACKEND_CONFIG.endpoints = { ...next.endpoints };
  BACKEND_CONFIG.openApiPath = next.openApiPath;
  return BACKEND_CONFIG;
}

async function readStoredOverride(): Promise<BackendConfigOverride | null> {
  if (!hasStorage()) return null;
  const payload = await chrome.storage.local.get(BACKEND_CONFIG_STORAGE_KEY);
  const candidate = payload[BACKEND_CONFIG_STORAGE_KEY];
  return isRecord(candidate) ? (candidate as BackendConfigOverride) : null;
}

async function readBuildPresetOverride(): Promise<BackendConfigOverride | null> {
  if (typeof fetch !== 'function') return null;
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return null;
  try {
    const response = await fetch(chrome.runtime.getURL(BACKEND_PRESET_CONFIG_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { tag?: unknown };
    return resolvePresetOverride(payload?.tag as string | null | undefined);
  } catch {
    return null;
  }
}

export async function initBackendConfig(): Promise<BackendConfig> {
  if (initialized) return BACKEND_CONFIG;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const buildPresetOverride = await readBuildPresetOverride();
        const override = await readStoredOverride();
        return applyBackendConfig(resolveBackendConfig(mergeOverrides(buildPresetOverride, override)));
      } catch (error) {
        console.warn('Failed to load backend config override, using defaults', error);
        return applyBackendConfig(resolveBackendConfig());
      } finally {
        initialized = true;
      }
    })();
  }
  return initPromise;
}

export async function setBackendConfigOverride(
  override: BackendConfigOverride | null,
): Promise<BackendConfig> {
  if (hasStorage()) {
    if (override) {
      await chrome.storage.local.set({ [BACKEND_CONFIG_STORAGE_KEY]: override });
    } else {
      await chrome.storage.local.remove(BACKEND_CONFIG_STORAGE_KEY);
    }
  }
  initialized = true;
  return applyBackendConfig(resolveBackendConfig(override));
}

export function getBackendConfig(): BackendConfig {
  return BACKEND_CONFIG;
}

export function buildBackendUrl(path: string): string {
  const config = getBackendConfig();
  const base = `${config.baseUrl}${config.basePath}`;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
