import { env } from "@/src/env";
import {
  BillingProviderError,
  type BillingProvider,
  type BillingPortalLink,
  type CheckoutSessionInput,
  type BillingUserContext,
} from "@/src/server/billing/provider";
import { listPlans } from "@/src/server/account-snapshot";
import { getBillingStatusFromSubscription } from "@/src/server/billing/subscription-status";

type NowPaymentsInvoiceResponse = {
  invoice_url?: string;
  pay_url?: string;
  error?: string;
  message?: string;
};

function assertNowPaymentsConfig(): void {
  if (!env.NOWPAYMENTS_API_KEY) {
    throw new BillingProviderError(
      "nowpayments_config_missing",
      "NOWPayments API key is missing.",
      { status: 500 },
    );
  }
}

function getNowPaymentsBaseUrl(): string {
  return env.NOWPAYMENTS_API_BASE_URL ?? "https://api.nowpayments.io";
}

function billingUrl(): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/billing`;
}

function getPriceForCheckout(input: CheckoutSessionInput): {
  amount: number;
  currency: string;
  planName: string;
} {
  const plan = listPlans().find((item) => item.id === input.planId);
  if (!plan) {
    throw new BillingProviderError("invalid_plan", "Plan is not available.", {
      status: 400,
      retryable: false,
    });
  }

  const amount = input.interval === "year" ? plan.priceYearly : plan.priceMonthly;
  if (amount <= 0) {
    throw new BillingProviderError(
      "invalid_checkout_plan",
      "Selected plan cannot be purchased.",
      {
        status: 400,
        retryable: false,
      },
    );
  }

  return {
    amount,
    currency: plan.currency.toLowerCase(),
    planName: plan.name,
  };
}

function resolveNowPaymentsUrl(payload: NowPaymentsInvoiceResponse | null): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (typeof payload.invoice_url === "string" && payload.invoice_url.trim()) {
    return payload.invoice_url;
  }
  if (typeof payload.pay_url === "string" && payload.pay_url.trim()) {
    return payload.pay_url;
  }
  return null;
}

function resolveProviderErrorDetails(payload: NowPaymentsInvoiceResponse | null): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return undefined;
}

async function createNowPaymentsInvoice(
  input: CheckoutSessionInput,
): Promise<BillingPortalLink> {
  const { amount, currency, planName } = getPriceForCheckout(input);
  const successUrl = input.successUrl?.trim() || billingUrl();
  const cancelUrl = input.cancelUrl?.trim() || billingUrl();

  const body = {
    price_amount: amount,
    price_currency: currency,
    order_id: `trail-${input.userId}-${Date.now()}`,
    order_description: `Trail ${planName} (${input.interval})`,
    success_url: successUrl,
    cancel_url: cancelUrl,
    is_fixed_rate: true,
  };

  let response: Response;
  try {
    response = await fetch(new URL("/v1/invoice", getNowPaymentsBaseUrl()), {
      method: "POST",
      headers: {
        "x-api-key": env.NOWPAYMENTS_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new BillingProviderError(
      "nowpayments_unavailable",
      "Billing provider is unavailable.",
      {
        status: 503,
        retryable: true,
      },
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | NowPaymentsInvoiceResponse
    | null;

  if (!response.ok) {
    throw new BillingProviderError(
      "checkout_failed",
      "Failed to create checkout session.",
      {
        status: 502,
        retryable: true,
        details: resolveProviderErrorDetails(payload),
      },
    );
  }

  const url = resolveNowPaymentsUrl(payload);
  if (!url) {
    throw new BillingProviderError(
      "checkout_failed",
      "Billing provider did not return a checkout url.",
      {
        status: 502,
        retryable: true,
      },
    );
  }

  return { url, expiresAt: null };
}

function createFallbackPortalLink(): BillingPortalLink {
  return {
    url: billingUrl(),
    expiresAt: null,
  };
}

export function createNowPaymentsBillingProvider(): BillingProvider {
  assertNowPaymentsConfig();

  return {
    async getBillingStatus(input: BillingUserContext) {
      return getBillingStatusFromSubscription(input.userId);
    },
    async createCheckoutSession(input: CheckoutSessionInput): Promise<BillingPortalLink> {
      return createNowPaymentsInvoice(input);
    },
    async createBillingPortalSession(
      _input: BillingUserContext,
    ): Promise<BillingPortalLink> {
      return createFallbackPortalLink();
    },
  };
}
