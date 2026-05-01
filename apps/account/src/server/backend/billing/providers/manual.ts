import { env } from "@/src/env";
import type {
  BillingProvider,
  BillingPortalLink,
  CheckoutSessionInput,
  BillingUserContext,
} from "@/src/server/backend/billing/provider";
import { BillingProviderError } from "@/src/server/backend/billing/provider";
import { getBillingStatusFromSubscription } from "@/src/server/backend/billing/subscription-status";
import { validateRedirectUrl } from "@/src/server/backend/billing/validate-redirect-url";
import { db } from "@trail/db";
import { assertOk } from "@trail/db/helpers";
import { addInterval } from "@/src/server/backend/subscription/period";

function billingUrl(): string {
  return `${env.appBaseUrl.replace(/\/$/, "")}/billing`;
}

function link(): BillingPortalLink {
  return { url: billingUrl(), expiresAt: null };
}

async function activateTestSubscription(input: CheckoutSessionInput): Promise<void> {
  if (input.planId !== "pro" && input.planId !== "teams") {
    throw new BillingProviderError("invalid_plan", "Plan is not available.", {
      status: 400,
      retryable: false,
    });
  }

  const now = new Date();
  const interval = input.interval;
  const currentPeriodStart = now;
  const currentPeriodEnd = addInterval(now, interval);
  const plan = input.planId === "teams" ? "TEAMS" : "PRO";

  assertOk(
    await db.from("user_subscriptions").upsert(
      {
        user_id: input.userId,
        plan,
        status: "ACTIVE",
        interval: interval === "year" ? "YEAR" : "MONTH",
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
        pending_interval: null,
      },
      { onConflict: "user_id" },
    ),
  );
}

export function createManualBillingProvider(): BillingProvider {
  return {
    async getBillingStatus(input: BillingUserContext) {
      return getBillingStatusFromSubscription(input.userId);
    },
    async createCheckoutSession(
      input: CheckoutSessionInput,
    ): Promise<BillingPortalLink> {
      if (env.BILLING_TEST_MODE) {
        await activateTestSubscription(input);
        return {
          url: validateRedirectUrl(input.successUrl, billingUrl()),
          expiresAt: null,
        };
      }

      return link();
    },
    async createBillingPortalSession(
      _input: BillingUserContext,
    ): Promise<BillingPortalLink> {
      return link();
    },
  };
}
