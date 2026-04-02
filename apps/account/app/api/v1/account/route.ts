import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { buildAccountSnapshot } from "@/src/server/backend/account-snapshot";
import { getUserById } from "@/src/server/backend/user";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";
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
  const extension = token ? await verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await getUserById(extension.sub);
  if (!user) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
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

  return jsonOk(snapshot);
}
