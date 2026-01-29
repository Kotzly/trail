"use client";

import Link from "next/link";
import {
  BackpackIcon,
  BarChartIcon,
  ClockIcon,
  DesktopIcon,
  LightningBoltIcon,
  RocketIcon
} from "@radix-ui/react-icons";
import { Button, EmptyState, StatCard } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { trpc } from "@/src/trpc/client";

export function DashboardClient() {
  const { dashboard } = accountCopy;
  const health = trpc.health.useQuery();
  const me = trpc.me.useQuery();

  const recentTrails: Array<{
    id: string;
    title: string;
    summary: string;
    timestamp: string;
  }> = [];

  const hasTrails = recentTrails.length > 0;
  const displayName =
    me.data?.user?.name?.trim() ||
    me.data?.user?.email?.split("@")[0] ||
    "trail member";

  const statusLabel = health.data?.ok ? dashboard.status.online : dashboard.status.checking;
  const lastSync = health.data?.timestamp
    ? new Date(health.data.timestamp).toLocaleString()
    : dashboard.status.lastSyncFallback;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">{dashboard.recent.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">{dashboard.recent.title}</p>
            <p className="text-xs text-ink-muted">{dashboard.recent.subtitle}</p>
          </div>
          <span className="trail-status">
            {hasTrails ? dashboard.recent.activeCount : dashboard.recent.emptyCount}
          </span>
        </div>

        {hasTrails ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recentTrails.map((trail) => (
              <div
                key={trail.id}
                className="rounded-2xl border border-border/50 bg-surface/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{trail.title}</p>
                  <span className="trail-status">{trail.timestamp}</span>
                </div>
                <p className="mt-2 text-xs text-ink-muted">{trail.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={dashboard.empty.title}
            description={dashboard.empty.description}
            icon={<BackpackIcon className="h-5 w-5" />}
            items={dashboard.empty.items}
            action={
              <Button asChild size="sm">
                <Link href="/extension">{dashboard.empty.cta}</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild size="sm" variant="outline">
                <Link href="/settings">{dashboard.empty.secondaryCta}</Link>
              </Button>
            }
          />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-border/40 bg-surface/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-muted">{dashboard.status.eyebrow}</p>
              <p className="text-sm font-semibold text-ink">{dashboard.status.title}</p>
              <p className="text-xs text-ink-muted">{dashboard.status.subtitle}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StatCard
              label={dashboard.status.stats.sync}
              value={statusLabel}
              caption={lastSync}
              icon={<LightningBoltIcon className="h-4 w-4" />}
            />
            <StatCard
              label={dashboard.status.stats.sessions}
              value={hasTrails ? "2" : "0"}
              caption={dashboard.status.stats.sessionsCaption}
              icon={<DesktopIcon className="h-4 w-4" />}
            />
            <StatCard
              label={dashboard.status.stats.trails}
              value={hasTrails ? "12" : "0"}
              caption={dashboard.status.stats.trailsCaption}
              icon={<BarChartIcon className="h-4 w-4" />}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <Link href="/extension" className="text-ink transition hover:text-ink">
              {dashboard.status.actions.extension}
            </Link>
            <span>•</span>
            <Link href="/settings" className="text-ink transition hover:text-ink">
              {dashboard.status.actions.settings}
            </Link>
            <span>•</span>
            <Link href="/billing" className="text-ink transition hover:text-ink">
              {dashboard.status.actions.billing}
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-surface/50 p-4">
          <div>
            <p className="text-xs text-ink-muted">{dashboard.insights.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">{dashboard.insights.title}</p>
            <p className="text-xs text-ink-muted">{dashboard.insights.subtitle}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <StatCard
              label={dashboard.insights.stats.coverage}
              value={hasTrails ? "68%" : dashboard.insights.stats.emptyValue}
              caption={dashboard.insights.stats.coverageCaption}
              icon={<RocketIcon className="h-4 w-4" />}
            />
            <StatCard
              label={dashboard.insights.stats.lastTrail}
              value={hasTrails ? "2h" : dashboard.insights.stats.emptyValue}
              caption={dashboard.insights.stats.lastTrailCaption}
              icon={<ClockIcon className="h-4 w-4" />}
            />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {hasTrails
              ? dashboard.insights.footerActive.replace("{name}", displayName)
              : dashboard.insights.footerEmpty}
          </p>
        </div>
      </section>
    </div>
  );
}
