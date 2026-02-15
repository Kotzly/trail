import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/backend/auth/billing-user";
import {
  BillingProviderError,
  getBillingProvider,
} from "@/src/server/backend/billing/provider";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  try {
    const billing = await getBillingProvider().getBillingStatus({
      userId: user.id,
      userEmail: user.email,
    });
    return jsonNoStore(billing);
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
