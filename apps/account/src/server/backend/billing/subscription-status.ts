import { db } from "@trail/db";
import { maybeRow } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { BillingStatus } from "@/src/server/backend/billing/provider";

type DbStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "UNKNOWN"
  | null
  | undefined;

type SubscriptionStatusRow = {
  plan: "FREE" | "PRO" | "TEAMS" | null;
  status: DbStatus;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  updated_at: string;
};

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function getBillingStatusFromSubscription(
  userId: string,
): Promise<BillingStatus> {
  const subscription = maybeRow(
    typed<SubscriptionStatusRow | null>(
      await db
        .from("user_subscriptions")
        .select("plan, status, cancel_at_period_end, current_period_end, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ),
  );

  if (
    !subscription ||
    subscription.plan === "FREE" ||
    (subscription.current_period_end &&
      new Date(subscription.current_period_end).getTime() <= Date.now())
  ) {
    return { state: "none" };
  }

  const nextChargeAt = toIso(
    subscription.current_period_end ? new Date(subscription.current_period_end) : null,
  );
  const lastChargeAt = toIso(
    subscription.updated_at ? new Date(subscription.updated_at) : null,
  );

  if (subscription.cancel_at_period_end) {
    return { state: "canceled", nextChargeAt, lastChargeAt };
  }

  switch (subscription.status) {
    case "ACTIVE":
      return { state: "ok", nextChargeAt, lastChargeAt };
    case "TRIALING":
      return { state: "trialing", nextChargeAt, lastChargeAt };
    case "PAST_DUE":
      return { state: "past_due", nextChargeAt, lastChargeAt };
    case "UNPAID":
      return { state: "unpaid", nextChargeAt, lastChargeAt };
    case "CANCELED":
      return { state: "canceled", nextChargeAt, lastChargeAt };
    case "INCOMPLETE":
    case "UNKNOWN":
    default:
      return { state: "grace", nextChargeAt, lastChargeAt };
  }
}
