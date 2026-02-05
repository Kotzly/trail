import Link from "next/link";
import { ArrowRightIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { Activity, Layers, Laptop } from "lucide-react";
import { Button } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@/app/components/PageHeader";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  // Placeholder для данных (в реальном приложении - из API)
  const hasExtension = false;
  const trailCount = 0;
  const sessionCount = 0;

  return (
    <section className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow={accountCopy.nav.dashboard}
        title={dashboard.title}
        subtitle={dashboard.subtitle}
      />

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Sync Status */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-bg">
              <Activity className="h-5 w-5 text-ink-muted" />
            </div>
            <div>
              <p className="text-xs text-ink-muted lowercase">sync</p>
              <p className="text-sm font-medium text-ink lowercase">
                {hasExtension ? "online" : "offline"}
              </p>
            </div>
          </div>
        </div>

        {/* Sessions */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-bg">
              <Laptop className="h-5 w-5 text-ink-muted" />
            </div>
            <div>
              <p className="text-xs text-ink-muted lowercase">sessions</p>
              <p className="text-sm font-medium text-ink lowercase">{sessionCount} active</p>
            </div>
          </div>
        </div>

        {/* Trails */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-bg">
              <Layers className="h-5 w-5 text-ink-muted" />
            </div>
            <div>
              <p className="text-xs text-ink-muted lowercase">trails</p>
              <p className="text-sm font-medium text-ink lowercase">{trailCount} captured</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Empty State */}
      <div className="rounded-[28px] border border-border/60 bg-surface/80 px-8 py-12 text-center">
        <div className="mx-auto max-w-md">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-bg">
            <LightningBoltIcon className="h-8 w-8 text-accent" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold lowercase text-ink">
            {dashboard.empty.title}
          </h2>

          {/* Description */}
          <p className="mt-2 text-sm text-ink-muted">
            {dashboard.empty.description}
          </p>

          {/* Feature List */}
          <ul className="mt-6 space-y-2 text-left text-sm text-ink-muted">
            {dashboard.empty.items.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="lowercase">{item}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button.AsChild size="sm" className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover">
              <Link href="/extension" className="inline-flex items-center gap-2">
                {dashboard.empty.cta}
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </Button.AsChild>
            <Button.AsChild size="sm" variant="outline" className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high">
              <Link href="/getting-started">
                getting started
              </Link>
            </Button.AsChild>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/extension"
          className="group rounded-2xl border border-border/60 bg-surface/60 px-5 py-4 transition hover:border-accent/40"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted lowercase">extension</p>
              <p className="text-sm font-medium text-ink lowercase group-hover:text-accent">
                connect your browser
              </p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent" />
          </div>
        </Link>

        <Link
          href="/settings"
          className="group rounded-2xl border border-border/60 bg-surface/60 px-5 py-4 transition hover:border-accent/40"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-muted lowercase">account</p>
              <p className="text-sm font-medium text-ink lowercase group-hover:text-accent">
                manage your profile
              </p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent" />
          </div>
        </Link>
      </div>
    </section>
  );
}
