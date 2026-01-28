import { accountCopy } from "@trail/content";
import { WaitlistDialog } from "@trail/ui";

export default function BillingPage() {
  const { billing } = accountCopy;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{billing.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{billing.subtitle}</p>
      </div>
      <div className="trail-card-soft rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Billing access</p>
        <p className="mt-3 text-sm text-ink-muted">
          Plans, invoices, and usage tracking are launching soon. Join the waitlist to be
          notified first.
        </p>
        <div className="mt-6">
          <WaitlistDialog
            triggerLabel={billing.cta}
            title="Get billing updates"
            description="Share your email and we will notify you when billing opens."
            source="billing"
            buttonVariant="outline"
          />
        </div>
      </div>
    </section>
  );
}
