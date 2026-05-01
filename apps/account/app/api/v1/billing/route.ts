import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getAuthenticatedUser } from "@/src/server/auth/get-authenticated-user";
import {
  BillingProviderError,
  getBillingProvider,
} from "@/src/server/backend/billing/provider";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const token = getBearerToken(request.headers);
  const user = await getAuthenticatedUser(token);
  if (!user) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  try {
    const billing = await getBillingProvider().getBillingStatus({
      userId: user.id,
      userEmail: user.email,
    });
    return jsonOk(billing);
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
