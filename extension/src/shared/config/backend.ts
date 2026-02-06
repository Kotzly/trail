export type BackendEnvironment = 'production' | 'staging' | 'local';
export type BackendMode = 'remote' | 'mock';

export type BackendEndpoints = {
  authPortal: string;
  logout: string;
  account: string;
  plans: string;
  subscription: string;
  billing: string;
  checkout: string;
  billingPortal: string;
  trailsSync: string;
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
const VALID_ENVS = new Set<BackendEnvironment>(['production', 'staging', 'local']);
const VALID_MODES = new Set<BackendMode>(['remote', 'mock']);

export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  env: 'production',
  mode: 'remote',
  baseUrl: 'https://app.gettrail.net',
  basePath: '/v1',
  portalUrl: 'https://app.gettrail.net/extension',
  timeoutMs: 10000,
  endpoints: {
    authPortal: '/auth/portal',
    logout: '/auth/logout',
    account: '/account',
    plans: '/plans',
    subscription: '/subscription',
    billing: '/billing',
    checkout: '/subscription/checkout',
    billingPortal: '/billing/portal',
    trailsSync: '/trails/sync',
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
      authPortal: normalizePath(endpointsInput?.authPortal, base.endpoints.authPortal),
      logout: normalizePath(endpointsInput?.logout, base.endpoints.logout),
      account: normalizePath(endpointsInput?.account, base.endpoints.account),
      plans: normalizePath(endpointsInput?.plans, base.endpoints.plans),
      subscription: normalizePath(endpointsInput?.subscription, base.endpoints.subscription),
      billing: normalizePath(endpointsInput?.billing, base.endpoints.billing),
      checkout: normalizePath(endpointsInput?.checkout, base.endpoints.checkout),
      billingPortal: normalizePath(endpointsInput?.billingPortal, base.endpoints.billingPortal),
      trailsSync: normalizePath(endpointsInput?.trailsSync, base.endpoints.trailsSync),
    },
    openApiPath:
      typeof override.openApiPath === 'string' && override.openApiPath.trim()
        ? override.openApiPath
        : base.openApiPath,
  };
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

export async function initBackendConfig(): Promise<BackendConfig> {
  if (initialized) return BACKEND_CONFIG;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const override = await readStoredOverride();
        return applyBackendConfig(resolveBackendConfig(override));
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
