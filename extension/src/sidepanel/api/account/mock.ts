import type {
  AccountError,
  AccountSnapshot,
  AuthPortalRequest,
  AuthPortalSession,
  AuthPortalStatus,
  AuthSession,
  BillingStatus,
  CheckoutInput,
  OnboardingState,
  Plan,
  PlanInterval,
  PortalLink,
  Subscription,
  User,
} from '../../../shared/types/account.js';
import type { Url } from '../../../shared/types/ids.js';
import type { AccountClient, CompleteOnboardingInput } from '../account.js';

const DEFAULT_DELAY_MS = 240;

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    features: ['Basic navigation history', 'Up to 3 trees', 'Local-only data'],
    limits: { maxTrees: 3, maxDevices: 1, maxHistoryDays: 7 },
    rank: 0,
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    priceMonthly: 8,
    priceYearly: 72,
    currency: 'USD',
    features: ['Unlimited trees', 'Sync across devices', 'Priority rendering'],
    limits: { maxTrees: 999, maxDevices: 5, maxHistoryDays: 90 },
    highlight: true,
    rank: 1,
  },
  {
    id: 'teams',
    name: 'Teams',
    tier: 'teams',
    priceMonthly: 16,
    priceYearly: 144,
    currency: 'USD',
    features: ['Shared workspaces', 'Team analytics', 'Admin controls'],
    limits: { maxTrees: 999, maxDevices: 15, maxHistoryDays: 180 },
    rank: 2,
  },
];

type MockState = {
  session: AuthSession;
  user: User | null;
  subscription: Subscription | null;
  billing: BillingStatus | null;
  onboardingSeenAt: string | null;
};

const state: MockState = {
  session: { status: 'guest' },
  user: null,
  subscription: null,
  billing: { state: 'none' },
  onboardingSeenAt: null,
};

type PortalSession = {
  id: string;
  expiresAt: number;
  approved: boolean;
};

const portalSessions = new Map<string, PortalSession>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function ensureNetwork(): void {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    const err: AccountError = {
      code: 'network',
      message: 'No network connection',
      retryable: true,
    };
    throw err;
  }
}

function requireAuth(): void {
  if (state.session.status !== 'authenticated' || !state.user) {
    const err: AccountError = {
      code: 'auth',
      message: 'Sign in to manage your subscription',
      retryable: false,
    };
    throw err;
  }
}

function buildMockOnboarding(): OnboardingState {
  if (state.onboardingSeenAt) {
    return { flowId: 'activation-v1', status: 'completed', seenAt: state.onboardingSeenAt };
  }
  return { flowId: 'activation-v1', status: 'pending', seenAt: null };
}

function snapshot(): AccountSnapshot {
  return {
    session: state.session,
    user: state.user,
    subscription: state.subscription,
    billing: state.billing,
    plans: [...plans],
    config: {
      payments: true,
    },
    onboarding: buildMockOnboarding(),
  };
}

function buildSubscription(planId: string, interval: PlanInterval, status: Subscription['status']): Subscription {
  const now = nowIso();
  const days = interval === 'year' ? 365 : 30;
  return {
    id: `sub_${Math.random().toString(16).slice(2)}`,
    planId,
    status,
    interval,
    currentPeriodStart: now,
    currentPeriodEnd: addDays(days),
    cancelAtPeriodEnd: false,
    trialEndsAt: status === 'trialing' ? addDays(14) : null,
    canceledAt: null,
  };
}

function buildPortalSession(): AuthPortalSession {
  const id = `portal_${Math.random().toString(16).slice(2)}`;
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const session: PortalSession = { id, expiresAt, approved: false };
  portalSessions.set(id, session);
  return {
    id,
    url: `https://trail.local/auth?session=${id}` as Url,
    expiresAt: new Date(expiresAt).toISOString(),
    pollIntervalMs: 800,
  };
}

function buildPortalLink(path: string): PortalLink {
  return {
    url: `https://trail.local${path}` as Url,
    expiresAt: addDays(1),
  };
}

function signInMockUser(email = 'demo@trail.app'): AccountSnapshot {
  const name = email.split('@')[0] ?? 'User';
  state.session = {
    status: 'authenticated',
    accessToken: `mock_${Math.random().toString(16).slice(2)}`,
    expiresAt: addDays(30),
  };
  state.user = {
    id: `user_${Math.random().toString(16).slice(2)}`,
    email,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    createdAt: nowIso(),
  };
  state.subscription = buildSubscription('pro', 'month', 'trialing');
  state.billing = updateBilling('pro', 'trialing');
  return snapshot();
}

function updateBilling(planId: string, status: Subscription['status']): BillingStatus {
  const paidPlan = planId !== 'free';
  if (!paidPlan) {
    return { state: 'none' };
  }
  if (status === 'trialing') {
    return { state: 'trialing', nextChargeAt: addDays(14), paymentMethod: null };
  }
  if (status === 'past_due') {
    return {
      state: 'past_due',
      lastChargeAt: addDays(-3),
      nextChargeAt: addDays(3),
      failureReason: 'Card declined',
      paymentMethod: { brand: 'Visa', last4: '0421', expMonth: 11, expYear: 2027 },
    };
  }
  if (status === 'canceled') {
    return {
      state: 'canceled',
      lastChargeAt: addDays(-12),
      paymentMethod: { brand: 'Visa', last4: '0421', expMonth: 11, expYear: 2027 },
    };
  }
  return {
    state: 'ok',
    lastChargeAt: addDays(-5),
    nextChargeAt: addDays(25),
    paymentMethod: { brand: 'Visa', last4: '0421', expMonth: 11, expYear: 2027 },
  };
}

export function createMockAccountClient(): AccountClient {
  return {
    async startAuthPortal(_input?: AuthPortalRequest): Promise<AuthPortalSession> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      return buildPortalSession();
    },

    async checkAuthPortal(sessionId: string): Promise<AuthPortalStatus> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      const session = portalSessions.get(sessionId);
      if (!session || Date.now() > session.expiresAt) {
        portalSessions.delete(sessionId);
        return { status: 'expired' };
      }
      if (!session.approved) {
        session.approved = true;
        const approvedSnapshot = signInMockUser();
        return { status: 'approved', snapshot: approvedSnapshot };
      }
      return { status: 'approved', snapshot: snapshot() };
    },

    async exchangeAuthBridgeCode(_code: string): Promise<AccountSnapshot> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      return signInMockUser();
    },

    async logout(): Promise<void> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      state.session = { status: 'guest' };
      state.user = null;
      state.subscription = null;
      state.billing = { state: 'none' };
    },

    async getProfile(): Promise<User | null> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      return state.user;
    },

    async getSubscription(): Promise<Subscription | null> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      return state.subscription;
    },

    async listPlans(): Promise<Plan[]> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      return [...plans];
    },

    async startCheckout(input: CheckoutInput): Promise<PortalLink> {
      ensureNetwork();
      requireAuth();
      await sleep(DEFAULT_DELAY_MS);
      const target = plans.find((plan) => plan.id === input.planId);
      if (!target) {
        const err: AccountError = {
          code: 'validation',
          message: 'Plan not found',
          retryable: false,
        };
        throw err;
      }

      const status: Subscription['status'] = 'active';
      state.subscription = buildSubscription(target.id, input.interval, status);
      state.billing = updateBilling(target.id, status);
      return buildPortalLink('/checkout');
    },

    async getBillingStatus(): Promise<BillingStatus | null> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 2);
      return state.billing;
    },

    async createBillingPortalLink(): Promise<PortalLink> {
      ensureNetwork();
      requireAuth();
      await sleep(DEFAULT_DELAY_MS / 2);
      return buildPortalLink('/billing');
    },

    async getSnapshot(): Promise<AccountSnapshot> {
      ensureNetwork();
      await sleep(DEFAULT_DELAY_MS / 1.2);
      return snapshot();
    },

    async completeOnboarding(_input: CompleteOnboardingInput): Promise<OnboardingState> {
      ensureNetwork();
      requireAuth();
      await sleep(DEFAULT_DELAY_MS / 2);
      state.onboardingSeenAt = nowIso();
      return buildMockOnboarding();
    },
  };
}
