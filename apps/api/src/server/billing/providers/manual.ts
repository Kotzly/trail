import { env } from "@/src/env";
import type {
  BillingProvider,
  BillingPortalLink,
  CheckoutSessionInput,
  BillingUserContext,
} from "@/src/server/billing/provider";
import { getBillingStatusFromSubscription } from "@/src/server/billing/subscription-status";

function billingUrl(): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/billing`;
}

function link(): BillingPortalLink {
  return { url: billingUrl(), expiresAt: null };
}

export function createManualBillingProvider(): BillingProvider {
  return {
    async getBillingStatus(input: BillingUserContext) {
      return getBillingStatusFromSubscription(input.userId);
    },
    async createCheckoutSession(
      _input: CheckoutSessionInput,
    ): Promise<BillingPortalLink> {
      return link();
    },
    async createBillingPortalSession(
      _input: BillingUserContext,
    ): Promise<BillingPortalLink> {
      return link();
    },
  };
}
