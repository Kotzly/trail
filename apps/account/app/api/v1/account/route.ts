import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { buildAccountSnapshot } from "@/src/server/backend/account-snapshot";
import { getUserById } from "@/src/server/backend/user";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  const extension = token ? await verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await getUserById(extension.sub);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const subscription = await getSubscriptionSnapshotForUser({
    userId: extension.sub,
    fallbackCreatedAt: user.createdAt,
  });

  const snapshot = buildAccountSnapshot({
    user,
    accessToken: token,
    subscription,
    onboardingSeenAt: user.onboardingSeenAt,
  });

  return jsonNoStore(snapshot);
}
