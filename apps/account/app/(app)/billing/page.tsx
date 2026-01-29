import { CheckIcon } from "@radix-ui/react-icons";
import { Badge, WaitlistDialog, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { listPlans } from "@/src/server/account-snapshot";

export default function BillingPage() {
  const { billing } = accountCopy;
  const plans = listPlans();

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-surface-strong text-xs font-medium text-ink">
              {billing.badgeEarly}
            </Badge>
            <Badge className="bg-surface-strong text-xs font-medium text-ink">
              {billing.badgePreview}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold lowercase text-ink sm:text-3xl">
            {billing.title}
          </h1>
          <p className="text-sm text-ink-muted">{billing.subtitle}</p>
        </div>
        <WaitlistDialog
          triggerLabel={billing.cta}
          title={billing.waitlistDialogTitle}
          description={billing.waitlistDialogDescription}
          source="billing"
          buttonVariant="outline"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isHighlighted = "highlight" in plan && plan.highlight;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex h-full flex-col rounded-2xl border border-border/60 bg-surface/70 p-4",
                isHighlighted && "border-ink/30"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold lowercase text-ink">{plan.name}</p>
                {isHighlighted ? (
                  <Badge className="bg-ink text-xs font-semibold text-surface">
                    {billing.planHighlight}
                  </Badge>
                ) : (
                  <span className="trail-pill">{billing.planCta}</span>
                )}
              </div>
              <div className="mt-3">
                <p className="text-2xl font-semibold text-ink">
                  {plan.priceMonthly === 0 ? billing.planFree : `$${plan.priceMonthly}`}
                </p>
                <p className="text-xs text-ink-muted">{billing.planPerMonth}</p>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-ink-muted lowercase">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-3 w-3 text-ink" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border/40 pt-3 text-xs text-ink-muted lowercase">
        {billing.waitlistNote}
      </div>
    </section>
  );
}
