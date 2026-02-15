import type {
  AccountError,
  AccountSnapshot,
  BillingStatus,
  CheckoutInput,
  OnboardingState,
  Plan,
  PortalLink,
  Subscription,
  User,
} from '../../shared/types/account.js';
import { BACKEND_CONFIG, initBackendConfig } from '../../shared/config/backend.js';
import { createMockAccountClient } from './account/mock.js';
import { createRemoteAccountClient } from './account/remote.js';
import { sendMessage } from './background.js';
import { rpc } from '../../shared/rpc/contracts.js';

export type CompleteOnboardingInput = {
  action: 'complete' | 'skip';
  source: 'extension' | 'web';
};

export type AccountClient = {
  getProfile: () => Promise<User | null>;
  getSubscription: () => Promise<Subscription | null>;
  listPlans: () => Promise<Plan[]>;
  getBillingStatus: () => Promise<BillingStatus | null>;
  getSnapshot: () => Promise<AccountSnapshot>;
  startCheckout: (input: CheckoutInput) => Promise<PortalLink>;
  createBillingPortalLink: () => Promise<PortalLink>;
  completeOnboarding: (input: CompleteOnboardingInput) => Promise<OnboardingState>;
};

function createDefaultClient(): AccountClient {
  return BACKEND_CONFIG.mode === 'mock' ? createMockAccountClient() : createRemoteAccountClient();
}

let accountClient: AccountClient = createDefaultClient();
let hasCustomClient = false;
let lastDefaultMode = BACKEND_CONFIG.mode;

export function setAccountClient(client: AccountClient): void {
  accountClient = client;
  hasCustomClient = true;
}

export function getAccountClient(): AccountClient {
  return accountClient;
}

async function getActiveAccountClient(): Promise<AccountClient> {
  if (hasCustomClient) return accountClient;
  await initBackendConfig();
  if (lastDefaultMode !== BACKEND_CONFIG.mode) {
    accountClient = createDefaultClient();
    lastDefaultMode = BACKEND_CONFIG.mode;
  }
  return accountClient;
}

export async function getAccountSnapshot(): Promise<AccountSnapshot> {
  return (await getActiveAccountClient()).getSnapshot();
}

export async function getProfile(): Promise<User | null> {
  return (await getActiveAccountClient()).getProfile();
}

export async function getSubscription(): Promise<Subscription | null> {
  return (await getActiveAccountClient()).getSubscription();
}

export async function listPlans(): Promise<Plan[]> {
  return (await getActiveAccountClient()).listPlans();
}

export async function getBillingStatus(): Promise<BillingStatus | null> {
  return (await getActiveAccountClient()).getBillingStatus();
}

export async function startCheckout(input: CheckoutInput): Promise<PortalLink> {
  return (await getActiveAccountClient()).startCheckout(input);
}

export async function createBillingPortalLink(): Promise<PortalLink> {
  return (await getActiveAccountClient()).createBillingPortalLink();
}

export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<OnboardingState> {
  return (await getActiveAccountClient()).completeOnboarding(input);
}

export async function requestOauthInteractiveLoginFromBackground(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const response = await sendMessage(rpc.oauthInteractiveLogin());
  if (!response.success) {
    return { ok: false, reason: response.error };
  }
  return response.data;
}

export async function requestOauthSilentSyncFromBackground(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const response = await sendMessage(rpc.oauthSilentSync());
  if (!response.success) {
    return { ok: false, reason: response.error };
  }
  return response.data;
}

export function normalizeAccountError(error: unknown): AccountError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const err = error as AccountError;
    const normalized: AccountError = {
      code: err.code ?? 'unknown',
      message: err.message ?? 'Unknown error',
      retryable: err.retryable ?? true,
    };
    if (typeof err.details === 'string') {
      normalized.details = err.details;
    }
    return normalized;
  }
  if (error instanceof Error) {
    return {
      code: 'unknown',
      message: error.message,
      retryable: true,
    };
  }
  return {
    code: 'unknown',
    message: 'Something went wrong',
    retryable: true,
  };
}

export { BACKEND_CONFIG };
