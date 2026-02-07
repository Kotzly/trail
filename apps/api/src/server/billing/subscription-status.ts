import { db } from "@trail/db";
import type { BillingStatus } from "@/src/server/billing/provider";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function getBillingStatusFromSubscription(
  userId: string,
): Promise<BillingStatus> {
  const subscription = await db.userSubscription.findUnique({
    where: { userId },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
      updatedAt: true,
    },
  });

  if (
    !subscription ||
    subscription.plan === "FREE" ||
    (subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() <= Date.now())
  ) {
    return { state: "none" };
  }

  const nextChargeAt = toIso(subscription.currentPeriodEnd);
  const lastChargeAt = toIso(subscription.updatedAt);

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
