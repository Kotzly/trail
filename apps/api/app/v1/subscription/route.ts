import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { getUserById } from "@/src/server/user";

export const runtime = "nodejs";

function buildSubscriptionStub(createdAt: Date) {
  const start = createdAt.toISOString();
  const end = new Date(
    createdAt.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    id: "sub_free",
    planId: "free",
    status: "active",
    interval: "month",
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt: null,
  };
}

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

  return jsonNoStore(buildSubscriptionStub(user.createdAt));
}
