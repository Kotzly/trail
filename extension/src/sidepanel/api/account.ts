import type {
  AccountError,
  AccountSnapshot,
  AuthPortalRequest,
  AuthPortalSession,
  AuthPortalStatus,
  BillingStatus,
  CheckoutInput,
  Plan,
  PortalLink,
  Subscription,
  User,
} from '../../shared/types/account.js';
import { BACKEND_CONFIG } from '../../shared/config/backend.js';
import { createMockAccountClient } from './account/mock.js';
import { createRemoteAccountClient } from './account/remote.js';

export type AccountClient = {
  startAuthPortal: (input?: AuthPortalRequest) => Promise<AuthPortalSession>;
  checkAuthPortal: (sessionId: string) => Promise<AuthPortalStatus>;
  logout: () => Promise<void>;
  getProfile: () => Promise<User | null>;
  getSubscription: () => Promise<Subscription | null>;
  listPlans: () => Promise<Plan[]>;
  getBillingStatus: () => Promise<BillingStatus | null>;
  getSnapshot: () => Promise<AccountSnapshot>;
  startCheckout: (input: CheckoutInput) => Promise<PortalLink>;
  createBillingPortalLink: () => Promise<PortalLink>;
};

const defaultClient =
  BACKEND_CONFIG.env === 'local' ? createMockAccountClient() : createRemoteAccountClient();

let accountClient: AccountClient = defaultClient;

export function setAccountClient(client: AccountClient): void {
  accountClient = client;
}

export function getAccountClient(): AccountClient {
  return accountClient;
}

export async function getAccountSnapshot(): Promise<AccountSnapshot> {
  return accountClient.getSnapshot();
}

export async function startAuthPortal(input?: AuthPortalRequest): Promise<AuthPortalSession> {
  return accountClient.startAuthPortal(input);
}

export async function checkAuthPortal(sessionId: string): Promise<AuthPortalStatus> {
  return accountClient.checkAuthPortal(sessionId);
}

export async function logout(): Promise<void> {
  return accountClient.logout();
}

export async function getProfile(): Promise<User | null> {
  return accountClient.getProfile();
}

export async function getSubscription(): Promise<Subscription | null> {
  return accountClient.getSubscription();
}

export async function listPlans(): Promise<Plan[]> {
  return accountClient.listPlans();
}

export async function getBillingStatus(): Promise<BillingStatus | null> {
  return accountClient.getBillingStatus();
}

export async function startCheckout(input: CheckoutInput): Promise<PortalLink> {
  return accountClient.startCheckout(input);
}

export async function createBillingPortalLink(): Promise<PortalLink> {
  return accountClient.createBillingPortalLink();
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
