import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Button, EmptyState } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@/app/components/PageHeader";

export default function ActivityPage() {
  const { activity } = accountCopy;
  const hasActivity = false;

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
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
                {activity.stream.eyebrow}
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {activity.stream.title}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {activity.stream.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activity.stream.filters.map((filter) => (
                <span key={filter} className="trail-pill">
                  {filter}
                </span>
              ))}
            </div>
          </div>

          {hasActivity ? (
            <div className="mt-4 text-xs text-ink-muted">
              activity list goes here
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
                  <Button.AsChild
                    size="sm"
                    className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover"
                  >
                    <Link href="/extension">{activity.empty.cta}</Link>
                  </Button.AsChild>
                }
                secondaryAction={
                  <Button.AsChild
                    size="sm"
                    variant="outline"
                    className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
                  >
                    <Link href="/getting-started">
                      {activity.empty.secondaryCta}
                    </Link>
                  </Button.AsChild>
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {activity.next.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {activity.next.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {activity.next.subtitle}
            </p>
            <div className="mt-4">
              <Button.AsChild
                size="sm"
                variant="outline"
                className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
              >
                <Link href="/extension">{activity.next.cta}</Link>
              </Button.AsChild>
            </div>
          </div>

          <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {activity.coverage.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {activity.coverage.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {activity.coverage.subtitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
