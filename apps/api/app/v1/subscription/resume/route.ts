import { db } from "@trail/db";
import { getBearerToken } from "@/src/server/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/auth/billing-user";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { getSubscriptionSnapshotForUser } from "@/src/server/subscription-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const existing = await db.userSubscription.findUnique({
    where: { userId: user.id },
    select: { plan: true, currentPeriodEnd: true },
  });

  if (!existing || existing.plan === "FREE") {
    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });
    return jsonNoStore(snapshot);
  }

  // If the subscription is already expired, resuming does nothing.
  if (existing.currentPeriodEnd && existing.currentPeriodEnd.getTime() <= Date.now()) {
    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });
    return jsonNoStore(snapshot);
  }

  await db.userSubscription.update({
    where: { userId: user.id },
    data: { status: "ACTIVE" },
  });

  const snapshot = await getSubscriptionSnapshotForUser({
    userId: user.id,
    fallbackCreatedAt: user.createdAt,
  });

  return jsonNoStore(snapshot);
}

