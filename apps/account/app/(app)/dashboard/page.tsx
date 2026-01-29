import Link from "next/link";
import { ArrowRightIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { SectionHeader, StepList } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  return (
    <section className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Link
          href="/extension"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/50 bg-surface/60 px-4 py-2.5 transition hover:border-border"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface">
              <LightningBoltIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-ink-muted">{dashboard.activation.eyebrow}</p>
              <p className="text-sm font-semibold text-ink">
                {dashboard.activation.title}
              </p>
              <p className="text-xs text-ink-muted">{dashboard.activation.subtitle}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink">
            {dashboard.activation.cta}
            <ArrowRightIcon className="h-3 w-3 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <div className="rounded-2xl border border-border/50 bg-surface/60 p-4">
          <SectionHeader
            title={dashboard.onboarding.title}
            subtitle={dashboard.onboarding.subtitle}
            actions={<span className="trail-pill">{dashboard.onboarding.progress}</span>}
          />
          <StepList className="mt-4" steps={dashboard.onboarding.steps} />
        </div>
      </div>

      <DashboardClient />
    </section>
  );
}
