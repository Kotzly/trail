import type {
  AccountError,
  AccountErrorCode,
  AccountSnapshot,
  BillingStatus,
  CheckoutInput,
  Plan,
  PortalLink,
  Subscription,
  User,
} from '../../../shared/types/account.js';
import {
  BACKEND_CONFIG,
  buildBackendUrl,
  initBackendConfig,
} from '../../../shared/config/backend.js';
import { AUTH_STORAGE_KEY } from '../../../shared/config/storage-keys.js';
import type { AccountClient, CompleteOnboardingInput } from '../account.js';

type StoredAuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
};
const ERROR_CODES: AccountErrorCode[] = ['network', 'auth', 'payment', 'validation', 'unknown'];

function canPersist(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function loadAuth(): Promise<StoredAuthSession | null> {
  if (!canPersist()) return null;
  try {
    const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    const stored = result[AUTH_STORAGE_KEY] as StoredAuthSession | undefined;
    return stored ?? null;
  } catch (error) {
    console.error('Account auth: failed to load session', error);
    return null;
  }
}

// saveAuth / extractAuth / syncAuthFromSnapshot were removed — the
// backend's /account endpoint may omit refreshToken/expiresAt from the
// session object, and blindly overwriting chrome.storage would destroy
// the tokens saved during login. Token lifecycle is owned exclusively
// by the background authOrchestrator.

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
  await initBackendConfig();
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

function buildGuestSnapshot(plans: Plan[] = []): AccountSnapshot {
  return {
    session: { status: 'guest' },
    user: null,
    subscription: null,
    billing: { state: 'none' },
    plans,
    config: {},
    onboarding: { flowId: 'activation-v1', status: 'pending', seenAt: null },
  };
}

export function createRemoteAccountClient(): AccountClient {
  const getSnapshot = async (): Promise<AccountSnapshot> => {
    const token = await getAccessToken();
    if (!token) {
      const plans = await requestJson<Plan[]>(
        BACKEND_CONFIG.endpoints.plans,
        {},
        { auth: false },
      ).catch(() => []);
      return buildGuestSnapshot(plans);
    }

    try {
      const snapshot = await requestJson<AccountSnapshot>(BACKEND_CONFIG.endpoints.account);
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
        // Do NOT clear tokens here — the background authOrchestrator owns
        // token lifecycle and will attempt refresh with the stored refreshToken.
        const plans = await requestJson<Plan[]>(
          BACKEND_CONFIG.endpoints.plans,
          {},
          { auth: false },
        ).catch(() => []);
        return buildGuestSnapshot(plans);
      }
      throw error;
    }
  };

  const getProfile = async (): Promise<User | null> => {
    const snapshot = await getSnapshot();
    return snapshot.user;
  };

  return {
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
    completeOnboarding: async (input: CompleteOnboardingInput) => {
      const result = await requestJson<{ onboarding: import('../../../shared/types/account.js').OnboardingState }>(
        BACKEND_CONFIG.endpoints.onboarding,
        { method: 'POST', body: JSON.stringify(input) },
      );
      return result.onboarding;
    },
  };
}
