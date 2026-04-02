"use server";

import { redirect } from "next/navigation";
import { db } from "@trail/db";
import { getAuthSession } from "@/src/lib/auth";
import { getBillingProvider } from "@/src/server/backend/billing/provider";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";

type ActionResult = { error?: string; success?: boolean };

export async function createCheckout(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const planId = formData.get("planId");
  const interval = formData.get("interval");

  if (typeof planId !== "string" || !planId) return { error: "Missing plan" };
  if (interval !== "month" && interval !== "year") return { error: "Invalid interval" };

  const successUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/billing?success=1`;
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/billing`;

  const link = await getBillingProvider().createCheckoutSession({
    userId: session.user.id,
    userEmail: session.user.email,
    planId,
    interval,
    successUrl,
    cancelUrl,
  });

  redirect(link.url);
}

export async function cancelSubscription(): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const { error } = await db
    .from("user_subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
    })
    .eq("user_id", session.user.id);

  if (error) return { error: "Failed to cancel subscription" };

  return { success: true };
}

export async function resumeSubscription(): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const { error } = await db
    .from("user_subscriptions")
    .update({
      cancel_at_period_end: false,
      canceled_at: null,
    })
    .eq("user_id", session.user.id);

  if (error) return { error: "Failed to resume subscription" };

  return { success: true };
}

export async function openBillingPortal(): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const link = await getBillingProvider().createBillingPortalSession({
    userId: session.user.id,
    userEmail: session.user.email,
  });

  redirect(link.url);
}

export async function getSubscriptionSnapshot() {
  const session = await getAuthSession();
  if (!session) return null;

  return getSubscriptionSnapshotForUser({
    userId: session.user.id,
  });
}
