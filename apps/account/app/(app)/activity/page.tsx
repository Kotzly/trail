import Link from "next/link";
import { ArrowRight } from "@trail/ui/icons";
import { Button, Card, EmptyState, SectionHeader } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@trail/ui";
import { getAccountUsageSnapshot } from "@/src/server/account-usage";
import { formatDateTime } from "@/src/server/device-presentation";

export default async function ActivityPage() {
  const { activity } = accountCopy;
  const usage = await getAccountUsageSnapshot();
  const hasActivity = usage.recentTrails.length > 0;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.activity}
        title={activity.title}
        subtitle={activity.subtitle}
        actions={
          <Button.AsChild
            size="sm"
            variant="outline"
            className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
          >
            <Link
              href="/getting-started"
              className="inline-flex items-center gap-2"
            >
              {activity.empty.secondaryCta}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={activity.stream.eyebrow}
            title={activity.stream.title}
            subtitle={activity.stream.subtitle}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {activity.stream.filters.map((filter) => (
                  <span key={filter} className="trail-pill">
                    {filter}
                  </span>
                ))}
              </div>
            }
          />

          {hasActivity ? (
            <div className="mt-4 divide-y divide-border/40">
              {usage.recentTrails.map((trail) => (
                <div
                  key={trail.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {trail.label}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {trail.rootTitle ?? "Untitled root"} • {trail.nodeCount}{" "}
                      nodes
                    </p>
                  </div>
                  <span className="trail-status">
                    {formatDateTime(trail.savedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title={activity.empty.title}
                description={activity.empty.description}
                icon={
                  <span className="h-5 w-5 rounded-full border border-border/60" />
                }
                items={activity.empty.items}
                action={
                  <Button.AsChild size="sm">
                    <Link href="/extension">{activity.empty.cta}</Link>
                  </Button.AsChild>
                }
                secondaryAction={
                  <Button.AsChild size="sm" variant="outline">
                    <Link href="/getting-started">
                      {activity.empty.secondaryCta}
                    </Link>
                  </Button.AsChild>
                }
              />
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[26px] bg-surface/60">
            <SectionHeader
              eyebrow={activity.next.eyebrow}
              title={activity.next.title}
              subtitle={activity.next.subtitle}
            />
            <div className="mt-4">
              <Button.AsChild size="sm" variant="outline">
                <Link href="/extension">{activity.next.cta}</Link>
              </Button.AsChild>
            </div>
          </Card>

          <Card className="rounded-[26px] bg-surface/60">
            <SectionHeader
              eyebrow={activity.coverage.eyebrow}
              title={activity.coverage.title}
              subtitle={activity.coverage.subtitle}
            />
          </Card>
        </div>
      </div>
    </section>
  );
}
