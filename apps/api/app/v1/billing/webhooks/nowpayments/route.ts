import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@trail/db";
import type { Prisma } from "@trail/db";
import { env } from "@/src/env";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { addInterval } from "@/src/server/subscription/period";
import { isUpgrade, type PlanId } from "@/src/server/subscription/proration";

export const runtime = "nodejs";

type NowPaymentsWebhookPayload = Record<string, unknown> & {
  order_id?: string;
  payment_id?: string | number;
  payment_status?: string;
};

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

function mapCheckoutIntervalToDbInterval(value: string | null | undefined): "MONTH" | "YEAR" {
  return value === "year" ? "YEAR" : "MONTH";
}

function mapDbIntervalToCheckoutInterval(value: "MONTH" | "YEAR"): "month" | "year" {
  return value === "YEAR" ? "year" : "month";
}

export async function POST(request: Request) {
  const secret = env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    return jsonError(
      "nowpayments_config_missing",
      "NOWPayments IPN secret is missing.",
      { status: 500 },
    );
  }

  const sig = request.headers.get("x-nowpayments-sig");
  if (!sig) {
    return jsonError("unauthorized", "Missing webhook signature.", {
      status: 401,
    });
  }

  const raw = await request.text();
  let payload: NowPaymentsWebhookPayload | null = null;
  try {
    payload = JSON.parse(raw) as NowPaymentsWebhookPayload;
  } catch {
    return jsonError("invalid_payload", "Invalid webhook payload.", {
      status: 400,
    });
  }

  const expected = computeSignature(payload, secret);
  if (!safeEqualHex(sig, expected)) {
    return jsonError("unauthorized", "Invalid webhook signature.", {
      status: 401,
    });
  }

  const orderId = typeof payload.order_id === "string" ? payload.order_id.trim() : "";
  if (!orderId) {
    return jsonError("invalid_payload", "Missing order_id.", { status: 400 });
  }

  const session = await db.billingCheckoutSession.findUnique({
    where: { orderId },
    select: {
      orderId: true,
      userId: true,
      planId: true,
      interval: true,
      requestedInterval: true,
    },
  });

  // Acknowledge unknown orders as OK to avoid infinite retries.
  if (!session) {
    return jsonNoStore({ ok: true });
  }

  const paymentStatus =
    typeof payload.payment_status === "string" ? payload.payment_status : null;
  const paymentId =
    typeof payload.payment_id === "string" || typeof payload.payment_id === "number"
      ? String(payload.payment_id)
      : null;

  await db.billingCheckoutSession.update({
    where: { orderId },
    data: {
      status: "WEBHOOK_RECEIVED",
      paymentStatus,
      ...(paymentId ? { nowpaymentsPaymentId: paymentId } : {}),
      lastPayload: payload as Prisma.InputJsonValue,
    },
  });

  const mapped = mapPaymentStatus(paymentStatus);
  const now = new Date();

  if (mapped.state === "succeeded") {
    const targetDbPlan = mapCheckoutPlanToDbPlan(session.planId);
    if (targetDbPlan) {
      const requestedInterval = session.requestedInterval ?? session.interval;
      const requestedDbInterval = mapCheckoutIntervalToDbInterval(requestedInterval);

      const existing = await db.userSubscription.findUnique({
        where: { userId: session.userId },
        select: {
          plan: true,
          interval: true,
          pendingInterval: true,
          createdAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      });

      const existingPlanId = existing ? mapDbPlanToPlanId(existing.plan) : "free";
      const existingInterval = existing ? mapDbIntervalToCheckoutInterval(existing.interval) : null;
      const existingPeriodStart = existing?.currentPeriodStart ?? existing?.createdAt ?? null;
      const existingPeriodEnd =
        existing?.currentPeriodEnd && existingPeriodStart
          ? existing.currentPeriodEnd
          : existingPeriodStart && existingInterval
            ? addInterval(existingPeriodStart, existingInterval)
            : null;

      const isExpired = existingPeriodEnd ? existingPeriodEnd.getTime() <= now.getTime() : true;
      const targetPlanId = session.planId as PlanId;

      if (existing && !isExpired && existingInterval && existingPeriodStart && existingPeriodEnd) {
        // Upgrade within the current period: keep renewal date, apply pending interval if requested.
        if (isUpgrade(existingPlanId, targetPlanId)) {
          await db.userSubscription.update({
            where: { userId: session.userId },
            data: {
              plan: targetDbPlan,
              status: "ACTIVE",
              cancelAtPeriodEnd: false,
              canceledAt: null,
              pendingInterval: requestedDbInterval !== existing.interval ? requestedDbInterval : null,
              // Keep currentPeriodStart/currentPeriodEnd intact.
            },
          });
        } else if (existingPlanId === targetPlanId && !existing.cancelAtPeriodEnd) {
          // Renewal payment: advance period and apply pending interval.
          const appliedInterval = existing.pendingInterval ?? existing.interval;
          const appliedCheckoutInterval = mapDbIntervalToCheckoutInterval(appliedInterval);
          const nextStart = existingPeriodEnd;
          const nextEnd = addInterval(nextStart, appliedCheckoutInterval);

          await db.userSubscription.update({
            where: { userId: session.userId },
            data: {
              status: "ACTIVE",
              cancelAtPeriodEnd: false,
              canceledAt: null,
              interval: appliedInterval,
              pendingInterval: null,
              currentPeriodStart: nextStart,
              currentPeriodEnd: nextEnd,
            },
          });
        } else {
          // Unknown/unsupported change: keep subscription unchanged, but record the checkout as succeeded.
        }
      } else {
        // New subscription (or expired): start a fresh period from now.
        const currentPeriodStart = now;
        const currentPeriodEnd = addInterval(
          now,
          requestedDbInterval === "YEAR" ? "year" : "month",
        );

        await db.userSubscription.upsert({
          where: { userId: session.userId },
          create: {
            userId: session.userId,
            plan: targetDbPlan,
            status: "ACTIVE",
            interval: requestedDbInterval,
            pendingInterval: null,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
            canceledAt: null,
          },
          update: {
            plan: targetDbPlan,
            status: "ACTIVE",
            interval: requestedDbInterval,
            pendingInterval: null,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
            canceledAt: null,
          },
        });
      }
    }

    await db.billingCheckoutSession.update({
      where: { orderId },
      data: { status: "SUCCEEDED" },
    });
  }

  if (mapped.state === "refunded") {
    await db.userSubscription.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        plan: "FREE",
        status: "UNKNOWN",
        cancelAtPeriodEnd: false,
        canceledAt: now,
        pendingInterval: null,
        currentPeriodStart: now,
        currentPeriodEnd: now,
      },
      update: {
        plan: "FREE",
        status: "UNKNOWN",
        cancelAtPeriodEnd: false,
        canceledAt: now,
        pendingInterval: null,
        currentPeriodStart: now,
        currentPeriodEnd: now,
      },
    });

    await db.billingCheckoutSession.update({
      where: { orderId },
      data: { status: "REFUNDED" },
    });
  }

  if (mapped.state === "failed") {
    await db.billingCheckoutSession.update({
      where: { orderId },
      data: { status: "FAILED" },
    });
  }

  if (mapped.state === "in_progress") {
    await db.billingCheckoutSession.update({
      where: { orderId },
      data: { status: "IN_PROGRESS" },
    });
  }

  return jsonNoStore({ ok: true });
}
