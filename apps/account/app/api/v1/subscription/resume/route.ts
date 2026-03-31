import { db } from "@trail/db";
import { maybeRow, assertOk } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/backend/auth/billing-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";

export const runtime = "nodejs";

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const user = await getUserFromBillingBearerToken(token);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const existing = maybeRow(
    typed<{
      plan: string | null;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
      status: string | null;
    } | null>(
      await db
        .from("user_subscriptions")
        .select("plan, current_period_end, cancel_at_period_end, status")
        .eq("user_id", user.id)
        .maybeSingle(),
    ),
  );

  if (!existing || existing.plan === "FREE") {
    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });
    return jsonNoStore(snapshot);
  }

  // If the subscription is already expired, resuming does nothing.
  if (
    existing.current_period_end &&
    new Date(existing.current_period_end).getTime() <= Date.now()
  ) {
    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });
    return jsonNoStore(snapshot);
  }

  assertOk(
    await db
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
        ...(existing.status === "CANCELED" ? { status: "ACTIVE" } : {}),
      })
      .eq("user_id", user.id),
  );

  const snapshot = await getSubscriptionSnapshotForUser({
    userId: user.id,
    fallbackCreatedAt: user.createdAt,
  });

  return jsonNoStore(snapshot);
}
