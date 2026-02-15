import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/backend/auth/billing-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const subscription = await getSubscriptionSnapshotForUser({
    userId: user.id,
    fallbackCreatedAt: user.createdAt,
  });

  return jsonNoStore(subscription);
}
