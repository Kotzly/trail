import { CheckIcon } from "@radix-ui/react-icons";
import { Badge, Button, SectionHeader, WaitlistDialog, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { listPlans } from "@/src/server/account-snapshot";

export default function BillingPage() {
  const { billing } = accountCopy;
  const plans = listPlans();

  return (
    <section className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface/85 p-8 shadow-card">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-ink/5 blur-3xl" />
            <div className="absolute -right-10 bottom-6 h-40 w-40 rounded-full bg-ink/10 blur-3xl" />
          </div>
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-surface-strong text-xs font-semibold text-ink">
                {billing.badgeEarly}
              </Badge>
              <Badge className="bg-surface-strong text-xs font-semibold text-ink">
                {billing.badgePreview}
              </Badge>
            </div>
            <h1 className="trail-title">{billing.title}</h1>
            <p className="trail-copy text-base">{billing.subtitle}</p>
          </div>
        </div>

        <div className="trail-card p-6">
          <SectionHeader title={billing.waitlistTitle} subtitle={billing.waitlistSubtitle} />
          <div className="mt-5">
            <WaitlistDialog
              triggerLabel={billing.cta}
              title={billing.waitlistDialogTitle}
              description={billing.waitlistDialogDescription}
              source="billing"
              buttonVariant="primary"
            />
          </div>
          <p className="trail-copy mt-4 text-xs">{billing.waitlistNote}</p>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader title={billing.plansTitle} subtitle={billing.plansSubtitle} />
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isHighlighted = "highlight" in plan && plan.highlight;
            return (
            <div
              key={plan.id}
              className={cn(
                "flex h-full flex-col rounded-3xl border border-border/60 bg-surface/85 p-6 shadow-card",
                isHighlighted && "border-ink/30 bg-surface"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">{plan.name}</p>
                {isHighlighted ? (
                  <Badge className="bg-ink text-xs font-semibold text-surface">
                    {billing.planHighlight}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-4">
                <p className="text-3xl font-semibold text-ink">
                  {plan.priceMonthly === 0 ? billing.planFree : `$${plan.priceMonthly}`}
                </p>
                <p className="text-xs text-ink-muted">{billing.planPerMonth}</p>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-ink-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-3 w-3 text-ink" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-6" disabled>
                {billing.planCta}
              </Button>
            </div>
          );
          })}
        </div>
      </div>
    </section>
  );
}
