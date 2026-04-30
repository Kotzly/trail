import { db } from "@trail/db";
import { maybeRow, assertOk } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { getAuthenticatedUser } from "@/src/server/auth/get-authenticated-user";
import { env } from "@/src/env";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";

export const runtime = "nodejs";

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const token = getBearerToken(request.headers);
  const user = await getAuthenticatedUser(token);
  if (!user) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
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
    return jsonOk(snapshot);
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

    return jsonOk(snapshot);
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

  return jsonOk(snapshot);
}
