import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { buildAccountSnapshot } from "@/src/server/account-snapshot";
import { getUserById } from "@/src/server/user";
import { getSubscriptionSnapshotForUser } from "@/src/server/subscription-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  const extension = token ? verifyExtensionToken(token) : null;
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
  });

  return jsonNoStore(snapshot);
}
