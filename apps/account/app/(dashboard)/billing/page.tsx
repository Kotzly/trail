import { getAuthSession } from "@/src/lib/auth";
import { getUserById } from "@/src/server/backend/user";
import { getSubscriptionSnapshotForUser } from "@/src/server/backend/subscription-access";
import { trailPlans } from "@trail/content";
import { PricingTable } from "./pricing-table";

export const metadata = {
  title: "Billing",
};

export default async function BillingPage() {
  const session = await getAuthSession();
  if (!session) return null;

  const user = await getUserById(session.user.id);

  const snapshot = await getSubscriptionSnapshotForUser({
    userId: session.user.id,
    fallbackCreatedAt: user?.createdAt,
  });

  const plans = [...trailPlans];

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and payment details.
        </p>
      </div>
      <PricingTable plans={plans} snapshot={snapshot} />
    </div>
  );
}
