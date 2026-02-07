import { db } from "@trail/db";
import { getBearerToken } from "@/src/server/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/auth/billing-user";
import { env } from "@/src/env";
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

  // No subscription to cancel: treat as free.
  if (!existing || existing.plan === "FREE") {
    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });
    return jsonNoStore(snapshot);
  }

  if (env.BILLING_TEST_MODE) {
    // In test mode we want to validate the full upgrade/downgrade loop without
    // waiting for period end or external provider actions.
    await db.userSubscription.update({
      where: { userId: user.id },
      data: {
        plan: "FREE",
        status: "CANCELED",
        currentPeriodEnd: new Date(),
      },
    });

    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });

    return jsonNoStore(snapshot);
  }

  await db.userSubscription.update({
    where: { userId: user.id },
    data: {
      status: "CANCELED",
      // Leave `plan` and `currentPeriodEnd` intact so the user keeps access until expiry.
    },
  });

  const snapshot = await getSubscriptionSnapshotForUser({
    userId: user.id,
    fallbackCreatedAt: user.createdAt,
  });

  return jsonNoStore(snapshot);
}
