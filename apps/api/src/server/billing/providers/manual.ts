import { env } from "@/src/env";
import type {
  BillingProvider,
  BillingPortalLink,
  CheckoutSessionInput,
  BillingUserContext,
} from "@/src/server/billing/provider";
import { BillingProviderError } from "@/src/server/billing/provider";
import { getBillingStatusFromSubscription } from "@/src/server/billing/subscription-status";
import { db } from "@trail/db";

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function billingUrl(): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/billing`;
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

  const currentPeriodEnd = addDays(new Date(), input.interval === "year" ? 365 : 30);
  const plan = input.planId === "teams" ? "TEAMS" : "PRO";

  await db.userSubscription.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      plan,
      status: "ACTIVE",
      currentPeriodEnd,
    },
    update: {
      plan,
      status: "ACTIVE",
      currentPeriodEnd,
    },
  });
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
          url: input.successUrl?.trim() || billingUrl(),
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
