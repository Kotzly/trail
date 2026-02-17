import type { Url } from './ids.js';

export type PlanInterval = 'month' | 'year';
/** Arbitrary tier identifier — defined by the backend, not hardcoded. */
export type PlanTier = string;

export type PlanLimits = {
  maxTrees?: number;
  maxDevices?: number;
  maxHistoryDays?: number;
  maxSavedViews?: number;
};

export type Plan = {
  id: string;
  name: string;
  tier: PlanTier;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  limits?: PlanLimits;
  highlight?: boolean;
  rank: number;
};

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'expired';

export type Subscription = {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  interval: PlanInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
};

export type BillingState =
  | 'none'
  | 'trialing'
  | 'ok'
  | 'past_due'
  | 'unpaid'
  | 'grace'
  | 'canceled';

export type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type BillingStatus = {
  state: BillingState;
  lastChargeAt?: string | null;
  nextChargeAt?: string | null;
  graceEndsAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  failureReason?: string | null;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: Url | null;
  createdAt: string;
};

export type AuthSession = {
  status: 'guest' | 'authenticated';
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
};

export type AccountConfigValue = boolean | number | string | null;
export type AccountConfig = Record<string, AccountConfigValue>;

export type OnboardingFlowId = 'activation-v1';
export type OnboardingStatus = 'pending' | 'completed';

export type OnboardingState = {
  flowId: OnboardingFlowId;
  status: OnboardingStatus;
  seenAt: string | null;
};

export type AccountSnapshot = {
  session: AuthSession;
  user: User | null;
  subscription: Subscription | null;
  billing: BillingStatus | null;
  plans: Plan[];
  config: AccountConfig;
  onboarding: OnboardingState;
};

export type PortalLink = {
  url: Url;
  expiresAt?: string | null;
};

export type CheckoutInput = {
  planId: string;
  interval: PlanInterval;
  successUrl?: Url;
  cancelUrl?: Url;
};

export type AccountErrorCode = 'network' | 'auth' | 'payment' | 'validation' | 'unknown';

export type AccountError = {
  code: AccountErrorCode;
  message: string;
  retryable?: boolean;
  details?: string;
};
