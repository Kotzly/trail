import type {
  AccountError,
  AccountErrorCode,
  AccountSnapshot,
  AuthPortalRequest,
  AuthPortalSession,
  AuthPortalStatus,
  AuthSession,
  BillingStatus,
  CheckoutInput,
  Plan,
  PortalLink,
  Subscription,
  User,
} from '../../../shared/types/account.js';
import { BACKEND_CONFIG, buildBackendUrl } from '../../../shared/config/backend.js';
import type { AccountClient } from '../account.js';

type StoredAuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
};

const AUTH_STORAGE_KEY = 'trail_auth_session';
const ERROR_CODES: AccountErrorCode[] = ['network', 'auth', 'payment', 'validation', 'unknown'];

let authCache: StoredAuthSession | null = null;
let authLoaded = false;

function canPersist(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function loadAuth(): Promise<StoredAuthSession | null> {
  if (authLoaded) return authCache;
  authLoaded = true;
  if (!canPersist()) return null;
  try {
    const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    const stored = result[AUTH_STORAGE_KEY] as StoredAuthSession | undefined;
    authCache = stored ?? null;
    return authCache;
  } catch (error) {
    console.error('Account auth: failed to load session', error);
    return null;
  }
}

async function saveAuth(session: StoredAuthSession | null): Promise<void> {
  authCache = session;
  authLoaded = true;
  if (!canPersist()) return;
  try {
    if (!session) {
      await chrome.storage.local.remove(AUTH_STORAGE_KEY);
      return;
    }
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session });
  } catch (error) {
    console.error('Account auth: failed to persist session', error);
  }
}

function extractAuth(session: AuthSession | null | undefined): StoredAuthSession | null {
  if (!session || session.status !== 'authenticated') return null;
  if (!session.accessToken) return null;
  const auth: StoredAuthSession = { accessToken: session.accessToken };
  if (session.refreshToken) auth.refreshToken = session.refreshToken;
  if (session.expiresAt) auth.expiresAt = session.expiresAt;
  return auth;
}

async function syncAuthFromSnapshot(snapshot: AccountSnapshot | null): Promise<void> {
  if (!snapshot) return;
  await saveAuth(extractAuth(snapshot.session));
}

async function getAccessToken(): Promise<string | null> {
  const auth = await loadAuth();
  return auth?.accessToken ?? null;
}

function normalizeErrorCode(value: unknown, fallback: AccountErrorCode): AccountErrorCode {
  if (typeof value !== 'string') return fallback;
  return (ERROR_CODES as readonly string[]).includes(value) ? (value as AccountErrorCode) : fallback;
}

function buildNetworkError(): AccountError {
  return {
    code: 'network',
    message: 'Network error',
    retryable: true,
  };
}

async function buildHttpError(response: Response): Promise<AccountError> {
  const fallbackCode: AccountErrorCode =
    response.status === 401
      ? 'auth'
      : response.status === 400
        ? 'validation'
        : response.status === 402
          ? 'payment'
          : 'unknown';
  const retryable = response.status >= 500;
  try {
    const payload = (await response.json()) as {
      code?: unknown;
      message?: unknown;
      retryable?: unknown;
      details?: unknown;
    };
    const message =
      typeof payload.message === 'string' ? payload.message : `Request failed (${response.status})`;
    const err: AccountError = {
      code: normalizeErrorCode(payload.code, fallbackCode),
      message,
      retryable: typeof payload.retryable === 'boolean' ? payload.retryable : retryable,
    };
    if (typeof payload.details === 'string') {
      err.details = payload.details;
    }
    return err;
  } catch {
    return {
      code: fallbackCode,
      message: `Request failed (${response.status})`,
      retryable,
    };
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);
  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  try {
    const response = await fetch(buildBackendUrl(path), {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw await buildHttpError(response);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      console.error('Account API: failed to parse response', error);
      throw {
        code: 'unknown',
        message: 'Invalid server response',
        retryable: true,
      } as AccountError;
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      throw error;
    }
    throw buildNetworkError();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function isAccountError(error: unknown): error is AccountError {
  return Boolean(error && typeof error === 'object' && 'code' in error && 'message' in error);
}

export function createRemoteAccountClient(): AccountClient {
  const getSnapshot = async (): Promise<AccountSnapshot> => {
    try {
      const snapshot = await requestJson<AccountSnapshot>(BACKEND_CONFIG.endpoints.account);
      await syncAuthFromSnapshot(snapshot);
      if (!snapshot.plans || snapshot.plans.length === 0) {
        try {
          const plans = await requestJson<Plan[]>(BACKEND_CONFIG.endpoints.plans, {}, { auth: false });
          return { ...snapshot, plans };
        } catch {
          return snapshot;
        }
      }
      return snapshot;
    } catch (error) {
      if (isAccountError(error) && error.code === 'auth') {
        await saveAuth(null);
        const snapshot = await requestJson<AccountSnapshot>(BACKEND_CONFIG.endpoints.account, {}, { auth: false });
        await syncAuthFromSnapshot(snapshot);
        return snapshot;
      }
      throw error;
    }
  };

  const getProfile = async (): Promise<User | null> => {
    const snapshot = await getSnapshot();
    return snapshot.user;
  };

  return {
    startAuthPortal: async (input?: AuthPortalRequest): Promise<AuthPortalSession> => {
      const body = input ? JSON.stringify(input) : undefined;
      return requestJson<AuthPortalSession>(
        BACKEND_CONFIG.endpoints.authPortal,
        { method: 'POST', body: body ?? null },
        { auth: false },
      );
    },
    checkAuthPortal: async (sessionId: string): Promise<AuthPortalStatus> => {
      const status = await requestJson<AuthPortalStatus>(
        `${BACKEND_CONFIG.endpoints.authPortal}/${encodeURIComponent(sessionId)}`,
        {},
        { auth: false },
      );
      if (status.snapshot) {
        await syncAuthFromSnapshot(status.snapshot);
      }
      return status;
    },
    logout: async (): Promise<void> => {
      try {
        await requestJson<void>(BACKEND_CONFIG.endpoints.logout, { method: 'POST' });
      } finally {
        await saveAuth(null);
      }
    },
    getProfile,
    getSubscription: async (): Promise<Subscription | null> =>
      requestJson<Subscription | null>(BACKEND_CONFIG.endpoints.subscription),
    listPlans: async (): Promise<Plan[]> =>
      requestJson<Plan[]>(BACKEND_CONFIG.endpoints.plans, {}, { auth: false }),
    getBillingStatus: async (): Promise<BillingStatus | null> =>
      requestJson<BillingStatus | null>(BACKEND_CONFIG.endpoints.billing),
    getSnapshot,
    startCheckout: async (input: CheckoutInput): Promise<PortalLink> =>
      requestJson<PortalLink>(BACKEND_CONFIG.endpoints.checkout, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    createBillingPortalLink: async (): Promise<PortalLink> =>
      requestJson<PortalLink>(BACKEND_CONFIG.endpoints.billingPortal, { method: 'POST' }),
  };
}
