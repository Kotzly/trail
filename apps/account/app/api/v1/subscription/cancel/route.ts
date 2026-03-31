import { db } from "@trail/db";
import { maybeRow, assertOk } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getUserFromBillingBearerToken } from "@/src/server/backend/auth/billing-user";
import { env } from "@/src/env";
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
    typed<{ plan: string | null; current_period_end: string | null } | null>(
      await db
        .from("user_subscriptions")
        .select("plan, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ),
  );

  // No subscription to cancel: treat as free.
  if (
    !existing ||
    existing.plan === "FREE" ||
    (existing.current_period_end &&
      new Date(existing.current_period_end).getTime() <= Date.now())
  ) {
    const snapshot = await getSubscriptionSnapshotForUser({
      userId: user.id,
      fallbackCreatedAt: user.createdAt,
    });
    return jsonNoStore(snapshot);
  }

  if (env.BILLING_TEST_MODE) {
    // In test mode we want to validate the full upgrade/downgrade loop without
    // waiting for period end or external provider actions.
    assertOk(
      await db
        .from("user_subscriptions")
        .update({
          plan: "FREE",
          status: "UNKNOWN",
          cancel_at_period_end: false,
          canceled_at: new Date().toISOString(),
          pending_interval: null,
          current_period_end: new Date().toISOString(),
          current_period_start: new Date().toISOString(),
        })
        .eq("user_id", user.id),
    );

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
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        // Leave `plan`/`interval` and period boundaries intact so the user keeps access until expiry.
      })
      .eq("user_id", user.id),
  );

  const snapshot = await getSubscriptionSnapshotForUser({
    userId: user.id,
    fallbackCreatedAt: user.createdAt,
  });

  return jsonNoStore(snapshot);
}
