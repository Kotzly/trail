import { accountCopy } from "@trail/content";
import { Button } from "@trail/ui";

export default function BillingPage() {
  const { billing } = accountCopy;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{billing.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{billing.subtitle}</p>
      </div>
      <div className="rounded-2xl border border-border/50 bg-surface/80 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Polar</p>
        <p className="mt-3 text-sm text-ink-muted">
          We will connect Polar webhooks and checkout here. This space is ready for plans,
          invoices, and usage.
        </p>
        <Button className="mt-6" variant="outline">
          {billing.cta}
        </Button>
      </div>
    </section>
  );
}
