import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import {
  BillingProviderError,
  getBillingProvider,
} from "@/src/server/billing/provider";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { getUserById } from "@/src/server/user";

export const runtime = "nodejs";

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

  try {
    const link = await getBillingProvider().createBillingPortalSession({
      userId: user.id,
      userEmail: user.email,
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
