import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { db } from "@trail/db";
import type { Json } from "@trail/db/types";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { maybeRow } from "@trail/db/helpers";
import { env } from "@/src/env";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { addInterval } from "@/src/server/backend/subscription/period";
import {
  isUpgrade,
  type PlanId,
} from "@/src/server/backend/subscription/proration";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";

type CheckoutSessionRow = {
  order_id: string;
  status: string;
  user_id: string;
  plan_id: string;
  interval: string;
  requested_interval: string | null;
};

type UserSubscriptionRow = {
  plan: "FREE" | "PRO" | "TEAMS";
  interval: "MONTH" | "YEAR";
  pending_interval: "MONTH" | "YEAR" | null;
  created_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export const runtime = "nodejs";

const nowPaymentsWebhookSchema = z.looseObject({
  order_id: z.string().optional(),
  payment_id: z.union([z.string(), z.number()]).optional(),
  payment_status: z.string().optional(),
});

// Type inferred from schema, used in computeSignature and field access below.

function toBufferHex(value: string): Buffer {
  return Buffer.from(value, "hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(toBufferHex(left), toBufferHex(right));
  } catch {
    return false;
  }
}

function sortObject(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = sortObject(obj[key]);
  }
  return result;
}

function computeSignature(payload: unknown, secret: string): string {
  const sorted = sortObject(payload);
  const message = JSON.stringify(sorted);
  return createHmac("sha512", secret).update(message).digest("hex");
}

/**
 * Signature verification using NOWPayments' documented rule: HMAC-SHA512
 * over the sorted + re-serialized JSON payload. This function keeps
 * that behaviour (provider signs the same representation), but we
 * derive the input from the `raw` bytes to avoid any zod-parse round
 * trip changing number representation / undefined-stripping between
 * signing and verification (closes P2.31).
 */
function computeSignatureFromRaw(raw: string, secret: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "";
  }
  return computeSignature(parsed, secret);
}

function mapPaymentStatus(statusRaw: string | null | undefined): {
  state: "ignore" | "in_progress" | "succeeded" | "failed" | "refunded";
} {
  const status = (statusRaw ?? "").trim().toLowerCase();

  // NOWPayments statuses (non-exhaustive): waiting, confirming, confirmed, sending,
  // partially_paid, finished, failed, refunded, expired.
  if (status === "confirmed" || status === "finished") {
    return { state: "succeeded" };
  }
  if (status === "refunded") {
    return { state: "refunded" };
  }
  if (status === "failed" || status === "expired") {
    return { state: "failed" };
  }
  if (
    status === "waiting" ||
    status === "confirming" ||
    status === "sending" ||
    status === "partially_paid"
  ) {
    return { state: "in_progress" };
  }

  return { state: "ignore" };
}

function mapDbPlanToPlanId(plan: "FREE" | "PRO" | "TEAMS"): PlanId {
  switch (plan) {
    case "PRO":
      return "pro";
    case "TEAMS":
      return "teams";
    case "FREE":
    default:
      return "free";
  }
}

function mapCheckoutPlanToDbPlan(planId: string): "PRO" | "TEAMS" | null {
  if (planId === "pro") return "PRO";
  if (planId === "teams") return "TEAMS";
  return null;
}

function mapCheckoutIntervalToDbInterval(
  value: string | null | undefined,
): "MONTH" | "YEAR" {
  return value === "year" ? "YEAR" : "MONTH";
}

function mapDbIntervalToCheckoutInterval(
  value: "MONTH" | "YEAR",
): "month" | "year" {
  return value === "YEAR" ? "year" : "month";
}

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "webhook");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const secret = env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    return jsonFail(
      "nowpayments_config_missing",
      "NOWPayments IPN secret is missing.",
      { status: 500 },
    );
  }

  const sig = request.headers.get("x-nowpayments-sig");
  if (!sig) {
    return jsonFail("unauthorized", "Missing webhook signature.", {
      status: 401,
    });
  }

  const raw = await request.text();

  // Verify HMAC against the RAW request body (re-sorted) BEFORE any zod
  // parse. If zod drops extra fields or coerces numbers, the sorted
  // re-serialize we compute here would diverge from what the provider
  // signed — and attackers could spoof valid-looking payloads that our
  // server happens to parse identically. Always verify on bytes.
  const expected = computeSignatureFromRaw(raw, secret);
  if (!expected || !safeEqualHex(sig, expected)) {
    return jsonFail("unauthorized", "Invalid webhook signature.", {
      status: 401,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonFail("invalid_payload", "Invalid webhook payload.", {
      status: 400,
    });
  }

  const result = nowPaymentsWebhookSchema.safeParse(parsed);
  if (!result.success) {
    return jsonFail(
      "invalid_payload",
      "Webhook payload failed schema validation.",
      {
        status: 400,
      },
    );
  }
  const payload = result.data;

  const orderId =
    typeof payload.order_id === "string" ? payload.order_id.trim() : "";
  if (!orderId) {
    return jsonFail("invalid_payload", "Missing order_id.", { status: 400 });
  }

  const session = maybeRow(
    (await db
      .from("billing_checkout_sessions")
      .select(
        "order_id, status, user_id, plan_id, interval, requested_interval",
      )
      .eq("order_id", orderId)
      .maybeSingle()) as unknown as PostgrestSingleResponse<CheckoutSessionRow | null>,
  );

  // Acknowledge unknown orders as OK to avoid infinite retries.
  if (!session) {
    return jsonOk({ ok: true });
  }

  const paymentStatus =
    typeof payload.payment_status === "string" ? payload.payment_status : null;
  const paymentId =
    typeof payload.payment_id === "string" ||
    typeof payload.payment_id === "number"
      ? String(payload.payment_id)
      : null;

  const mapped = mapPaymentStatus(paymentStatus);
  const now = new Date();

  // Atomically claim the session: only proceed if the session is NOT in a terminal state.
  // This prevents concurrent webhook deliveries from both applying subscription mutations.
  // The WHERE-guard pattern replaces transaction atomicity.
  const claimResult = await db
    .from("billing_checkout_sessions")
    .update({
      status: "WEBHOOK_RECEIVED",
      payment_status: paymentStatus,
      ...(paymentId ? { nowpayments_payment_id: paymentId } : {}),
      last_payload: payload as Json,
    })
    .eq("order_id", orderId)
    .not("status", "in", '("SUCCEEDED","REFUNDED","FAILED")')
    .select("order_id");

  // Session already reached a terminal state — another webhook got there first.
  if (!claimResult.data || claimResult.data.length === 0) {
    return jsonOk({ ok: true });
  }

  // Deduplicate by provider payment ID: if another checkout already recorded this
  // payment, skip processing to avoid double-applying the same payment.
  if (paymentId) {
    const duplicate = maybeRow(
      (await db
        .from("billing_checkout_sessions")
        .select("order_id")
        .eq("nowpayments_payment_id", paymentId)
        .neq("order_id", orderId)
        .in("status", ["SUCCEEDED", "REFUNDED", "FAILED"])
        .limit(1)
        .maybeSingle()) as unknown as PostgrestSingleResponse<{
        order_id: string;
      } | null>,
    );
    if (duplicate) {
      return jsonOk({ ok: true });
    }
  }

  if (mapped.state === "succeeded") {
    const targetDbPlan = mapCheckoutPlanToDbPlan(session.plan_id);
    if (targetDbPlan) {
      const requestedInterval = session.requested_interval ?? session.interval;
      const requestedDbInterval =
        mapCheckoutIntervalToDbInterval(requestedInterval);

      const existing = maybeRow(
        (await db
          .from("user_subscriptions")
          .select(
            "plan, interval, pending_interval, created_at, current_period_start, current_period_end, cancel_at_period_end",
          )
          .eq("user_id", session.user_id)
          .maybeSingle()) as unknown as PostgrestSingleResponse<UserSubscriptionRow | null>,
      );

      const existingPlanId = existing
        ? mapDbPlanToPlanId(existing.plan as "FREE" | "PRO" | "TEAMS")
        : "free";
      const existingInterval = existing
        ? mapDbIntervalToCheckoutInterval(existing.interval as "MONTH" | "YEAR")
        : null;
      const existingPeriodStart = existing?.current_period_start
        ? new Date(existing.current_period_start)
        : existing?.created_at
          ? new Date(existing.created_at)
          : null;
      const existingPeriodEnd =
        existing?.current_period_end && existingPeriodStart
          ? new Date(existing.current_period_end)
          : existingPeriodStart && existingInterval
            ? addInterval(existingPeriodStart, existingInterval)
            : null;

      const isExpired = existingPeriodEnd
        ? existingPeriodEnd.getTime() <= now.getTime()
        : true;
      const targetPlanId = session.plan_id as PlanId;

      if (
        existing &&
        !isExpired &&
        existingInterval &&
        existingPeriodStart &&
        existingPeriodEnd
      ) {
        // Upgrade within the current period: keep renewal date, apply pending interval if requested.
        if (isUpgrade(existingPlanId, targetPlanId)) {
          await db
            .from("user_subscriptions")
            .update({
              plan: targetDbPlan,
              status: "ACTIVE",
              cancel_at_period_end: false,
              canceled_at: null,
              pending_interval:
                requestedDbInterval !== existing.interval
                  ? requestedDbInterval
                  : null,
              // Keep current_period_start/current_period_end intact.
            })
            .eq("user_id", session.user_id);
        } else if (
          existingPlanId === targetPlanId &&
          !existing.cancel_at_period_end
        ) {
          // Renewal payment: advance period and apply pending interval.
          const appliedInterval = (existing.pending_interval ??
            existing.interval) as "MONTH" | "YEAR";
          const appliedCheckoutInterval =
            mapDbIntervalToCheckoutInterval(appliedInterval);
          const nextStart = existingPeriodEnd;
          const nextEnd = addInterval(nextStart, appliedCheckoutInterval);

          await db
            .from("user_subscriptions")
            .update({
              status: "ACTIVE",
              cancel_at_period_end: false,
              canceled_at: null,
              interval: appliedInterval,
              pending_interval: null,
              current_period_start: nextStart.toISOString(),
              current_period_end: nextEnd.toISOString(),
            })
            .eq("user_id", session.user_id);
        }
        // else: Unknown/unsupported change — keep subscription unchanged, record checkout as succeeded.
      } else {
        // New subscription (or expired): start a fresh period from now.
        const currentPeriodStart = now;
        const currentPeriodEnd = addInterval(
          now,
          requestedDbInterval === "YEAR" ? "year" : "month",
        );

        await db.from("user_subscriptions").upsert(
          {
            user_id: session.user_id,
            plan: targetDbPlan,
            status: "ACTIVE",
            interval: requestedDbInterval,
            pending_interval: null,
            current_period_start: currentPeriodStart.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
            cancel_at_period_end: false,
            canceled_at: null,
          },
          { onConflict: "user_id" },
        );
      }
    }

    await db
      .from("billing_checkout_sessions")
      .update({ status: "SUCCEEDED" })
      .eq("order_id", orderId);
  }

  if (mapped.state === "refunded") {
    await db.from("user_subscriptions").upsert(
      {
        user_id: session.user_id,
        plan: "FREE",
        status: "UNKNOWN",
        cancel_at_period_end: false,
        canceled_at: now.toISOString(),
        pending_interval: null,
        current_period_start: now.toISOString(),
        current_period_end: now.toISOString(),
      },
      { onConflict: "user_id" },
    );

    await db
      .from("billing_checkout_sessions")
      .update({ status: "REFUNDED" })
      .eq("order_id", orderId);
  }

  if (mapped.state === "failed") {
    await db
      .from("billing_checkout_sessions")
      .update({ status: "FAILED" })
      .eq("order_id", orderId);
  }

  if (mapped.state === "in_progress") {
    await db
      .from("billing_checkout_sessions")
      .update({ status: "IN_PROGRESS" })
      .eq("order_id", orderId);
  }

  return jsonOk({ ok: true });
}
