import Link from "next/link";
import {
  Activity,
  ArrowRightIcon,
  Laptop,
  Layers,
  LightningBoltIcon,
} from "@trail/ui/icons";
import { Button, EmptyState, StatCard } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@trail/ui";

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
        <StatCard
          label="sync"
          value={hasExtension ? "online" : "offline"}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="sessions"
          value={`${sessionCount} active`}
          icon={<Laptop className="h-4 w-4" />}
        />
        <StatCard
          label="trails"
          value={`${trailCount} captured`}
          icon={<Layers className="h-4 w-4" />}
        />
      </div>

      {/* Main Content - Empty State */}
      <EmptyState
        className="rounded-[28px] bg-surface/80 p-8"
        title={dashboard.empty.title}
        description={dashboard.empty.description}
        icon={<LightningBoltIcon className="h-5 w-5 text-accent" />}
        items={dashboard.empty.items}
        action={
          <Button.AsChild size="sm">
            <Link href="/extension" className="inline-flex items-center gap-2">
              {dashboard.empty.cta}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
        secondaryAction={
          <Button.AsChild size="sm" variant="outline">
            <Link href="/getting-started">getting started</Link>
          </Button.AsChild>
        }
      />

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
