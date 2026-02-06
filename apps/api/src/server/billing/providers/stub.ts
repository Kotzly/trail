import { env } from "@/src/env";
import type {
  BillingProvider,
  BillingPortalLink,
  BillingStatus,
  CheckoutSessionInput,
  BillingUserContext,
} from "@/src/server/billing/provider";

function billingUrl(): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/billing`;
}

function link(): BillingPortalLink {
  return { url: billingUrl(), expiresAt: null };
}

function status(): BillingStatus {
  return { state: "none" };
}

export function createStubBillingProvider(): BillingProvider {
  return {
    async getBillingStatus(_input: BillingUserContext): Promise<BillingStatus> {
      return status();
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
