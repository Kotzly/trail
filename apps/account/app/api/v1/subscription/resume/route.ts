import { db } from "@trail/db";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/backend/auth/billing-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const existing = await db.userSubscription.findUnique({
    where: { userId: user.id },
    select: { plan: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, status: true },
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
    data: {
      cancelAtPeriodEnd: false,
      canceledAt: null,
      ...(existing.status === "CANCELED" ? { status: "ACTIVE" } : {}),
    },
  });

  const snapshot = await getSubscriptionSnapshotForUser({
    userId: user.id,
    fallbackCreatedAt: user.createdAt,
  });

  return jsonNoStore(snapshot);
}
