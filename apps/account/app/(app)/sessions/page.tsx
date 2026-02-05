import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Button, EmptyState } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@/app/components/PageHeader";

export default function SessionsPage() {
  const { sessions } = accountCopy;
  const hasSessions = false;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.sessions}
        title={sessions.title}
        subtitle={sessions.subtitle}
        actions={
          <Button.AsChild
            size="sm"
            className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover"
          >
            <Link href="/extension" className="inline-flex items-center gap-2">
              {sessions.guidance.cta}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {sessions.list.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {sessions.list.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {sessions.list.subtitle}
            </p>
          </div>

          {hasSessions ? (
            <div className="mt-4 text-xs text-ink-muted">
              sessions list goes here
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title={sessions.list.emptyTitle}
                description={sessions.list.emptyDescription}
                icon={
                  <span className="h-5 w-5 rounded-full border border-border/60" />
                }
                items={sessions.list.emptyItems}
                action={
                  <Button.AsChild
                    size="sm"
                    className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover"
                  >
                    <Link href="/extension">{sessions.guidance.cta}</Link>
                  </Button.AsChild>
                }
              />
            </div>
          )}
        </div>

        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {sessions.posture.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {sessions.posture.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {sessions.posture.subtitle}
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {sessions.posture.items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-ink-muted">{item.label}</span>
                <span className="trail-status">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              {sessions.guidance.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {sessions.guidance.description}
            </p>
          </div>
          <Button.AsChild
            size="sm"
            variant="outline"
            className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
          >
            <Link href="/extension">{sessions.guidance.cta}</Link>
          </Button.AsChild>
        </div>
      </div>
    </section>
  );
}
