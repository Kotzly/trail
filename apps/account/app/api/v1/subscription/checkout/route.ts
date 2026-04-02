import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/backend/auth/billing-user";
import {
  BillingProviderError,
  getBillingProvider,
} from "@/src/server/backend/billing/provider";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";
import { subscriptionCheckoutBodySchema } from "@/src/server/api/schemas";
import { parseBody } from "@/src/server/api/validate";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(subscriptionCheckoutBodySchema, rawBody);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400 });
  }

  const body = parsed.data;

  try {
    const link = await getBillingProvider().createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      planId: body.planId,
      interval: body.interval,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
    return jsonOk(link);
  } catch (error) {
    if (error instanceof BillingProviderError) {
      return jsonFail(error.code, error.message, {
        status: error.status,
        retryable: error.retryable,
        details: error.details,
      });
    }
    throw error;
  }
}
