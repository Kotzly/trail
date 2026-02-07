import type { BillingProviderName } from "@/src/env";
import { env } from "@/src/env";
import { createNowPaymentsBillingProvider } from "@/src/server/billing/providers/nowpayments";
import { createManualBillingProvider } from "@/src/server/billing/providers/manual";

export type BillingStatus = {
  state: "none" | "trialing" | "ok" | "past_due" | "unpaid" | "grace" | "canceled";
  lastChargeAt?: string | null;
  nextChargeAt?: string | null;
  graceEndsAt?: string | null;
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  failureReason?: string | null;
};

export type BillingPortalLink = {
  url: string;
  expiresAt?: string | null;
};

export type CheckoutInterval = "month" | "year";

export type BillingUserContext = {
  userId: string;
  userEmail: string | null;
};

export type CheckoutSessionInput = BillingUserContext & {
  planId: string;
  interval: CheckoutInterval;
  successUrl?: string;
  cancelUrl?: string;
};

export interface BillingProvider {
  getBillingStatus(input: BillingUserContext): Promise<BillingStatus>;
  createCheckoutSession(input: CheckoutSessionInput): Promise<BillingPortalLink>;
  createBillingPortalSession(input: BillingUserContext): Promise<BillingPortalLink>;
}

export class BillingProviderError extends Error {
  code: string;
  status: number;
  retryable?: boolean;
  details?: string;

  constructor(
    code: string,
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      details?: string;
    } = {},
  ) {
    super(message);
    this.name = "BillingProviderError";
    this.code = code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable;
    this.details = options.details;
  }
}

const providerFactories: Record<BillingProviderName, () => BillingProvider> = {
  manual: createManualBillingProvider,
  nowpayments: createNowPaymentsBillingProvider,
};

const providers: Partial<Record<BillingProviderName, BillingProvider>> = {};

export function getBillingProvider(): BillingProvider {
  const providerName = env.BILLING_TEST_MODE ? "manual" : env.BILLING_PROVIDER;
  const existing = providers[providerName];
  if (existing) {
    return existing;
  }

  const provider = providerFactories[providerName]();
  providers[providerName] = provider;
  return provider;
}
