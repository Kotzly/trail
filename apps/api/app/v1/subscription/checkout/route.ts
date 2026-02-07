import { getBearerToken } from "@/src/server/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/auth/billing-user";
import {
  BillingProviderError,
  type CheckoutInterval,
  getBillingProvider,
} from "@/src/server/billing/provider";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";

export const runtime = "nodejs";

function isInterval(value: unknown): value is CheckoutInterval {
  return value === "month" || value === "year";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (
    typeof body?.planId !== "string" ||
    !body.planId.trim() ||
    !isInterval(body.interval) ||
    !isOptionalString(body.successUrl) ||
    !isOptionalString(body.cancelUrl)
  ) {
    return jsonError("invalid_checkout", "Invalid checkout input.", {
      status: 400,
    });
  }

  try {
    const link = await getBillingProvider().createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      planId: body.planId,
      interval: body.interval,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
    return jsonNoStore(link);
  } catch (error) {
    if (error instanceof BillingProviderError) {
      return jsonError(error.code, error.message, {
        status: error.status,
        retryable: error.retryable,
        details: error.details,
      });
    }
    throw error;
  }
}
