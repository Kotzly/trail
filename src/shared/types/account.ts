export type PlanInterval = 'month' | 'year';
export type PlanTier = 'free' | 'pro' | 'team' | 'enterprise';

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
  rank?: number;
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
  avatarUrl?: string | null;
  createdAt: string;
};

export type AuthSession = {
  status: 'guest' | 'authenticated';
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
};

export type AccountSnapshot = {
  session: AuthSession;
  user: User | null;
  subscription: Subscription | null;
  billing: BillingStatus | null;
  plans: Plan[];
};

export type AuthPortalRequest = {
  source?: string;
  locale?: string;
  returnUrl?: string;
};

export type AuthPortalSession = {
  id: string;
  url: string;
  expiresAt: string;
  pollIntervalMs?: number;
};

export type AuthPortalStatus = {
  status: 'pending' | 'approved' | 'expired';
  snapshot?: AccountSnapshot | null;
};

export type PortalLink = {
  url: string;
  expiresAt?: string | null;
};

export type CheckoutInput = {
  planId: string;
  interval: PlanInterval;
  successUrl?: string;
  cancelUrl?: string;
};

export type AccountErrorCode = 'network' | 'auth' | 'payment' | 'validation' | 'unknown';

export type AccountError = {
  code: AccountErrorCode;
  message: string;
  retryable?: boolean;
  details?: string;
};
