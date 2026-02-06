import { env } from "@/src/env";
import {
  BillingProviderError,
  type BillingProvider,
  type BillingPortalLink,
  type BillingStatus,
  type CheckoutSessionInput,
  type BillingUserContext,
} from "@/src/server/billing/provider";

const NOT_READY_ERROR = "NOWPayments billing provider is configured but not implemented yet.";

function assertNowPaymentsConfig(): void {
  if (!env.NOWPAYMENTS_API_KEY) {
    throw new BillingProviderError(
      "nowpayments_config_missing",
      "NOWPayments API key is missing.",
      { status: 500 },
    );
  }
}

function throwNotImplemented(): never {
  throw new BillingProviderError("billing_provider_not_ready", NOT_READY_ERROR, {
    status: 503,
    retryable: false,
  });
}

export function createNowPaymentsBillingProvider(): BillingProvider {
  assertNowPaymentsConfig();

  return {
    async getBillingStatus(_input: BillingUserContext): Promise<BillingStatus> {
      return throwNotImplemented();
    },
    async createCheckoutSession(
      _input: CheckoutSessionInput,
    ): Promise<BillingPortalLink> {
      return throwNotImplemented();
    },
    async createBillingPortalSession(
      _input: BillingUserContext,
    ): Promise<BillingPortalLink> {
      return throwNotImplemented();
    },
  };
}
