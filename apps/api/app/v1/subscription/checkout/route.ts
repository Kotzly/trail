import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import {
  BillingProviderError,
  type CheckoutInterval,
  getBillingProvider,
} from "@/src/server/billing/provider";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { getUserById } from "@/src/server/user";

export const runtime = "nodejs";

function isInterval(value: unknown): value is CheckoutInterval {
  return value === "month" || value === "year";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const extension = token ? verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await getUserById(extension.sub);
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
