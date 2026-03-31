import { randomUUID } from "crypto";
import { env } from "@/src/env";
import { db } from "@trail/db";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { maybeRow, assertOk } from "@trail/db/helpers";
import {
  BillingProviderError,
  type BillingProvider,
  type BillingPortalLink,
  type CheckoutSessionInput,
  type BillingUserContext,
} from "@/src/server/backend/billing/provider";
import { listPlans } from "@/src/server/backend/account-snapshot";
import { getBillingStatusFromSubscription } from "@/src/server/backend/billing/subscription-status";
import { addInterval } from "@/src/server/backend/subscription/period";
import { isUpgrade, proratedUpgradeChargeCents, type PlanId } from "@/src/server/backend/subscription/proration";
import { validateRedirectUrl } from "@/src/server/backend/billing/validate-redirect-url";

type NowPaymentsInvoiceResponse = {
  invoice_url?: string;
  pay_url?: string;
  error?: string;
  message?: string;
};

type UserSubscriptionRow = {
  plan: "FREE" | "PRO" | "TEAMS";
  interval: "MONTH" | "YEAR";
  created_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function assertNowPaymentsConfig(): void {
  if (!env.NOWPAYMENTS_API_KEY) {
    throw new BillingProviderError(
      "nowpayments_config_missing",
      "NOWPayments API key is missing.",
      { status: 500 },
    );
  }
  if (!env.NOWPAYMENTS_IPN_SECRET) {
    throw new BillingProviderError(
      "nowpayments_config_missing",
      "NOWPayments IPN secret is missing.",
      { status: 500 },
    );
  }
}

function getNowPaymentsBaseUrl(): string {
  return env.NOWPAYMENTS_API_BASE_URL ?? "https://api.nowpayments.io";
}

function billingUrl(): string {
  return `${env.appBaseUrl.replace(/\/$/, "")}/billing`;
}

function assertPaidPlanId(planId: string): asserts planId is Exclude<PlanId, "free"> {
  if (planId !== "pro" && planId !== "teams") {
    throw new BillingProviderError("invalid_plan", "Plan is not available.", {
      status: 400,
      retryable: false,
    });
  }
}

function mapDbPlanToPlanId(plan: "FREE" | "PRO" | "TEAMS"): PlanId {
  switch (plan) {
    case "PRO":
      return "pro";
    case "TEAMS":
      return "teams";
    case "FREE":
    default:
      return "free";
  }
}

function mapDbIntervalToCheckoutInterval(value: "MONTH" | "YEAR"): "month" | "year" {
  return value === "YEAR" ? "year" : "month";
}

function priceFor(
  planId: string,
  interval: "month" | "year",
): { amount: number; currency: string; planName: string } {
  const plan = listPlans().find((item) => item.id === planId);
  if (!plan) {
    throw new BillingProviderError("invalid_plan", "Plan is not available.", {
      status: 400,
      retryable: false,
    });
  }

  const amount = interval === "year" ? plan.priceYearly : plan.priceMonthly;
  return { amount, currency: plan.currency.toLowerCase(), planName: plan.name };
}

async function resolveCheckoutAmount(input: CheckoutSessionInput): Promise<{
  amountCents: number;
  currency: string;
  planName: string;
  chargeInterval: "month" | "year";
  requestedInterval: "month" | "year";
  mode: "new" | "upgrade" | "renewal" | "no_charge_upgrade";
}> {
  assertPaidPlanId(input.planId);

  const requestedInterval = input.interval;
  const now = new Date();

  const existing = maybeRow(
    await db
      .from("user_subscriptions")
      .select("plan, interval, created_at, current_period_start, current_period_end, cancel_at_period_end")
      .eq("user_id", input.userId)
      .maybeSingle() as unknown as PostgrestSingleResponse<UserSubscriptionRow | null>,
  );

  // Treat missing/expired subscriptions as a new purchase.
  const existingPlanId = existing ? mapDbPlanToPlanId(existing.plan) : "free";
  const existingInterval = existing ? mapDbIntervalToCheckoutInterval(existing.interval) : null;
  const existingPeriodStart = existing?.current_period_start
    ? new Date(existing.current_period_start)
    : existing?.created_at
      ? new Date(existing.created_at)
      : null;
  const existingPeriodEnd =
    existing?.current_period_end && existingPeriodStart
      ? new Date(existing.current_period_end)
      : existingPeriodStart && existingInterval
        ? addInterval(existingPeriodStart, existingInterval)
        : null;

  const isExpired = existingPeriodEnd ? existingPeriodEnd.getTime() <= now.getTime() : true;

  if (!existing || existingPlanId === "free" || isExpired || !existingInterval || !existingPeriodStart || !existingPeriodEnd) {
    const { amount, currency, planName } = priceFor(input.planId, requestedInterval);
    if (amount <= 0) {
      throw new BillingProviderError("invalid_checkout_plan", "Selected plan cannot be purchased.", {
        status: 400,
        retryable: false,
      });
    }
    return {
      mode: "new",
      amountCents: Math.round(amount * 100),
      currency,
      planName,
      chargeInterval: requestedInterval,
      requestedInterval,
    };
  }

  // Allow explicit renewals (not used by current UI, but keeps model robust).
  if (input.planId === existingPlanId && input.interval === existingInterval && !existing.cancel_at_period_end) {
    const { amount, currency, planName } = priceFor(input.planId, existingInterval);
    if (amount <= 0) {
      throw new BillingProviderError("invalid_checkout_plan", "Selected plan cannot be purchased.", {
        status: 400,
        retryable: false,
      });
    }
    return {
      mode: "renewal",
      amountCents: Math.round(amount * 100),
      currency,
      planName,
      chargeInterval: existingInterval,
      requestedInterval,
    };
  }

  if (!isUpgrade(existingPlanId, input.planId as PlanId)) {
    throw new BillingProviderError("invalid_plan_change", "Downgrades are not supported.", {
      status: 400,
      retryable: false,
    });
  }

  const fromPlan = listPlans().find((p) => p.id === existingPlanId);
  const toPlan = listPlans().find((p) => p.id === input.planId);
  if (!fromPlan || !toPlan) {
    throw new BillingProviderError("invalid_plan", "Plan is not available.", {
      status: 400,
      retryable: false,
    });
  }

  const { chargeCents } = proratedUpgradeChargeCents({
    now,
    currentPeriodStart: existingPeriodStart,
    currentPeriodEnd: existingPeriodEnd,
    fromPlan,
    toPlan,
    interval: existingInterval,
  });

  const { currency, planName } = priceFor(input.planId, existingInterval);

  return {
    mode: chargeCents <= 0 ? "no_charge_upgrade" : "upgrade",
    amountCents: Math.max(0, chargeCents),
    currency,
    planName,
    chargeInterval: existingInterval,
    requestedInterval,
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
  const pricing = await resolveCheckoutAmount(input);
  const amount = pricing.amountCents / 100;
  const currency = pricing.currency;
  const planName = pricing.planName;
  const fallback = billingUrl();
  const successUrl = validateRedirectUrl(input.successUrl, fallback);
  const cancelUrl = validateRedirectUrl(input.cancelUrl, fallback);
  const orderId = randomUUID();
  const amountCents = pricing.amountCents;

  // Some upgrades may be free (credit >= prorated charge). Apply immediately.
  if (pricing.mode === "no_charge_upgrade") {
    assertOk(
      await db.from("billing_checkout_sessions").insert({
        provider: "NOWPAYMENTS",
        order_id: orderId,
        user_id: input.userId,
        plan_id: input.planId,
        interval: pricing.chargeInterval,
        requested_interval: pricing.requestedInterval,
        currency: currency.toUpperCase(),
        amount_cents: amountCents,
        status: "SUCCEEDED",
      }),
    );

    // Apply upgrade immediately: keep the current period, clear cancellation and record pending interval (if any)
    // on the subscription itself.
    assertOk(
      await db
        .from("user_subscriptions")
        .update({
          plan: input.planId === "teams" ? "TEAMS" : "PRO",
          status: "ACTIVE",
          cancel_at_period_end: false,
          canceled_at: null,
          ...(pricing.requestedInterval !== pricing.chargeInterval
            ? { pending_interval: pricing.requestedInterval === "year" ? "YEAR" : "MONTH" }
            : { pending_interval: null }),
        })
        .eq("user_id", input.userId),
    );

    return { url: successUrl, expiresAt: null };
  }

  assertOk(
    await db.from("billing_checkout_sessions").insert({
      provider: "NOWPAYMENTS",
      order_id: orderId,
      user_id: input.userId,
      plan_id: input.planId,
      interval: pricing.chargeInterval,
      requested_interval: pricing.requestedInterval,
      currency: currency.toUpperCase(),
      amount_cents: amountCents,
      status: "CREATED",
    }),
  );

  const body = {
    price_amount: amount,
    price_currency: currency,
    order_id: orderId,
    order_description: `Trail ${planName} (${pricing.chargeInterval})`,
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
    await db
      .from("billing_checkout_sessions")
      .update({
        status: "FAILED",
        payment_status: null,
        last_payload: payload as Record<string, unknown> | null,
      })
      .eq("order_id", orderId)
      .then(() => null, () => null);
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
    await db
      .from("billing_checkout_sessions")
      .update({
        status: "FAILED",
        payment_status: null,
        last_payload: payload as Record<string, unknown> | null,
      })
      .eq("order_id", orderId)
      .then(() => null, () => null);
    throw new BillingProviderError(
      "checkout_failed",
      "Billing provider did not return a checkout url.",
      {
        status: 502,
        retryable: true,
      },
    );
  }

  await db
    .from("billing_checkout_sessions")
    .update({
      status: "REDIRECTED",
      nowpayments_invoice_url: url,
      last_payload: payload as Record<string, unknown> | null,
    })
    .eq("order_id", orderId)
    .then(() => null, () => null);

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
