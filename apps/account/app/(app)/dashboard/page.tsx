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
import { getAccountUsageSnapshot } from "@/src/server/account-usage";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default async function DashboardPage() {
  const { dashboard } = accountCopy;
  const usage = await getAccountUsageSnapshot();

  const hasExtension = usage.devices.length > 0;
  const trailCount = usage.trailCount;
  const sessionCount = usage.activeSessionCount;
  const hasTrails = usage.recentTrails.length > 0;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.dashboard}
        title={dashboard.title}
        subtitle={dashboard.subtitle}
      />

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

      {hasTrails ? (
        <div className="rounded-[28px] border border-border/60 bg-surface/80 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="trail-eyebrow">{dashboard.recent.eyebrow}</p>
              <p className="text-sm font-semibold text-ink">{dashboard.recent.title}</p>
            </div>
            <span className="trail-status">{`${trailCount} captured`}</span>
          </div>

          <div className="divide-y divide-border/40">
            {usage.recentTrails.map((trail) => (
              <div
                key={trail.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{trail.label}</p>
                  <p className="text-xs text-ink-muted">
                    {trail.rootTitle ?? "Untitled root"} • {trail.nodeCount} nodes
                  </p>
                </div>
                <span className="trail-status">{formatDateTime(trail.savedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
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
      )}

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
