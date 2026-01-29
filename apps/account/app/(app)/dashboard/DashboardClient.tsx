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
import { Button, EmptyState, SectionHeader, StatCard } from "@trail/ui";
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
    "Trail member";

  const statusLabel = health.data?.ok ? dashboard.status.online : dashboard.status.checking;
  const lastSync = health.data?.timestamp
    ? new Date(health.data.timestamp).toLocaleString()
    : "—";

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <SectionHeader title={dashboard.recent.title} subtitle={dashboard.recent.subtitle} />
        {hasTrails ? (
          <div className="grid gap-4 md:grid-cols-2">
            {recentTrails.map((trail) => (
              <div key={trail.id} className="trail-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{trail.title}</p>
                  <span className="trail-status">{trail.timestamp}</span>
                </div>
                <p className="trail-copy mt-3 text-xs">{trail.summary}</p>
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
              <Button asChild size="lg">
                <Link href="/extension">{dashboard.empty.cta}</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild size="lg" variant="outline">
                <Link href="/settings">{dashboard.empty.secondaryCta}</Link>
              </Button>
            }
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title={dashboard.status.title} subtitle={dashboard.status.subtitle} />
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="trail-card p-6">
            <SectionHeader
              title={dashboard.status.cardTitle}
              subtitle={dashboard.status.cardSubtitle}
              className="pb-4"
            />
            <div className="grid gap-4 md:grid-cols-3">
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
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/extension">{dashboard.status.actions.extension}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/settings">{dashboard.status.actions.settings}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/billing">{dashboard.status.actions.billing}</Link>
              </Button>
            </div>
          </div>

          <div className="trail-card p-6">
            <SectionHeader title={dashboard.insights.title} subtitle={dashboard.insights.subtitle} />
            <div className="mt-4 grid gap-4">
              <StatCard
                label={dashboard.insights.stats.coverage}
                value={hasTrails ? "68%" : "—"}
                caption={dashboard.insights.stats.coverageCaption}
                icon={<RocketIcon className="h-4 w-4" />}
              />
              <StatCard
                label={dashboard.insights.stats.lastTrail}
                value={hasTrails ? "2h ago" : "—"}
                caption={dashboard.insights.stats.lastTrailCaption}
                icon={<ClockIcon className="h-4 w-4" />}
              />
            </div>
            <p className="trail-copy mt-4 text-xs">
              {hasTrails
                ? dashboard.insights.footerActive.replace("{name}", displayName)
                : dashboard.insights.footerEmpty}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
