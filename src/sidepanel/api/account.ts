import type {
  AccountError,
  AccountSnapshot,
  BillingStatus,
  ChangePlanInput,
  LoginInput,
  Plan,
  Subscription,
  User,
} from '../../shared/types/account.js';
import { createMockAccountClient } from './account/mock.js';

export type AccountClient = {
  login: (input: LoginInput) => Promise<AccountSnapshot>;
  logout: () => Promise<void>;
  getProfile: () => Promise<User | null>;
  getSubscription: () => Promise<Subscription | null>;
  listPlans: () => Promise<Plan[]>;
  changePlan: (input: ChangePlanInput) => Promise<Subscription>;
  getBillingStatus: () => Promise<BillingStatus | null>;
  getSnapshot: () => Promise<AccountSnapshot>;
};

let accountClient: AccountClient = createMockAccountClient();

export function setAccountClient(client: AccountClient): void {
  accountClient = client;
}

export function getAccountClient(): AccountClient {
  return accountClient;
}

export async function getAccountSnapshot(): Promise<AccountSnapshot> {
  return accountClient.getSnapshot();
}

export async function login(input: LoginInput): Promise<AccountSnapshot> {
  return accountClient.login(input);
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

export async function changePlan(input: ChangePlanInput): Promise<Subscription> {
  return accountClient.changePlan(input);
}

export async function getBillingStatus(): Promise<BillingStatus | null> {
  return accountClient.getBillingStatus();
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
