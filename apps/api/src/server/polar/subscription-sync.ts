import { db } from "@trail/db";

type SubscriptionPlan = "FREE" | "PRO";
type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "UNKNOWN";

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function pickFirstObject(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function parseDate(...values: unknown[]): Date | null {
  for (const value of values) {
    if (!value) continue;
    if (value instanceof Date) return value;

    if (typeof value === "number") {
      // Accept both ms and sec
      const ms = value > 10_000_000_000 ? value : value * 1000;
      const date = new Date(ms);
      if (!Number.isNaN(date.valueOf())) return date;
      continue;
    }

    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.valueOf())) return date;
      continue;
    }
  }

  return null;
}

function mapStatus(status: string | null): SubscriptionStatus {
  if (!status) return "UNKNOWN";
  const normalized = status.trim().toLowerCase();

  switch (normalized) {
    case "active":
      return "ACTIVE";
    case "trialing":
    case "trial":
      return "TRIALING";
    case "past_due":
    case "past-due":
      return "PAST_DUE";
    case "canceled":
    case "cancelled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    case "incomplete":
      return "INCOMPLETE";
    default:
      return "UNKNOWN";
  }
}

export type PolarSubscriptionUpdate = {
  userId: string;
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
};

function readMetadata(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const anyObj = obj as Record<string, unknown>;
  const metadata = anyObj.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function resolveUserIdFromMetadata(params: {
  customer: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
}): { userId?: string } {
  const customerMetadata = readMetadata(params.customer);
  const subscriptionMetadata = readMetadata(params.subscription);

  const userId = pickFirstString(
    customerMetadata.trailUserId,
    customerMetadata.trail_user_id,
    customerMetadata.userId,
    customerMetadata.user_id,
    subscriptionMetadata.trailUserId,
    subscriptionMetadata.trail_user_id,
    subscriptionMetadata.userId,
    subscriptionMetadata.user_id
  );

  return {
    ...(userId ? { userId } : {})
  };
}

export async function syncSubscriptionFromPolarWebhook(params: {
  eventType: string;
  payload: unknown;
}): Promise<PolarSubscriptionUpdate | null> {
  const { payload } = params;

  // Polar webhooks follow Standard Webhooks, so payload is typically:
  // { type: string; timestamp: string; data: {...} }
  // But we defensively handle other shapes.
  const root = (payload && typeof payload === "object" ? (payload as any) : {}) as any;
  const data = (root.data ?? root) as any;

  const subscription = pickFirstObject(
    data.subscription,
    data.order?.subscription,
    data
  );
  const customer = pickFirstObject(
    data.customer,
    subscription?.customer,
    data.order?.customer
  );

  const polarCustomerId = pickFirstString(
    customer?.id,
    subscription?.customer_id,
    subscription?.customerId,
    data.customer_id,
    data.customerId
  );

  const polarSubscriptionId = pickFirstString(
    subscription?.id,
    subscription?.subscription_id,
    subscription?.subscriptionId,
    data.subscription_id,
    data.subscriptionId
  );

  const statusRaw = pickFirstString(subscription?.status, data.status);
  const currentPeriodEnd = parseDate(
    subscription?.current_period_end,
    subscription?.current_period_end_at,
    subscription?.currentPeriodEnd,
    subscription?.currentPeriodEndAt,
    data.current_period_end,
    data.currentPeriodEnd
  );

  // Resolve Trail user mapping.
  // Priority:
  // 1) explicit Trail user id in metadata
  // 2) existing UserSubscription lookup by polarCustomerId
  const metadataMapping = resolveUserIdFromMetadata({ customer, subscription });

  let userId: string | null = metadataMapping.userId ?? null;

  if (!userId && polarCustomerId) {
    const existing = await db.userSubscription.findUnique({
      where: { polarCustomerId }
    });
    userId = existing?.userId ?? null;
  }

  if (!userId) {
    throw new Error(
      `Unable to resolve Trail user for Polar webhook (polarCustomerId=${polarCustomerId ?? "null"}).`
    );
  }

  // v0 plan mapping: any subscription-related event implies PRO.
  // Future: map based on product/price IDs.
  const status = mapStatus(statusRaw);
  const plan: SubscriptionPlan = polarSubscriptionId ? "PRO" : "FREE";

  const record = await db.userSubscription.upsert({
    where: { userId },
    update: {
      plan,
      status,
      polarCustomerId,
      polarSubscriptionId,
      currentPeriodEnd
    },
    create: {
      userId,
      plan,
      status,
      polarCustomerId,
      polarSubscriptionId,
      currentPeriodEnd
    }
  });

  return {
    userId: record.userId,
    plan: record.plan,
    status: record.status,
    polarCustomerId: record.polarCustomerId,
    polarSubscriptionId: record.polarSubscriptionId,
    currentPeriodEnd: record.currentPeriodEnd
  };
}
