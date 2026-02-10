import { getBearerToken } from "@/src/server/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/auth/billing-user";
import {
  BillingProviderError,
  getBillingProvider,
} from "@/src/server/billing/provider";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";

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
