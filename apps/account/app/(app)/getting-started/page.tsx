import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Button, SectionHeader, StepList } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@/app/components/PageHeader";

export default function GettingStartedPage() {
  const { gettingStarted } = accountCopy;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.gettingStarted}
        title={gettingStarted.title}
        subtitle={gettingStarted.subtitle}
        actions={
          <Button.AsChild
            size="sm"
            className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover"
          >
            <Link href="/extension" className="inline-flex items-center gap-2">
              {gettingStarted.cta}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <SectionHeader
            title={gettingStarted.stepsTitle}
            subtitle={gettingStarted.stepsSubtitle}
            actions={
              <span className="trail-pill">{gettingStarted.progress}</span>
            }
          />
          <StepList className="mt-4" steps={gettingStarted.steps} />
        </div>

        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
            {gettingStarted.next.eyebrow}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {gettingStarted.next.title}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {gettingStarted.next.subtitle}
          </p>
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            {gettingStarted.next.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {gettingStarted.support.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {gettingStarted.support.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {gettingStarted.support.subtitle}
            </p>
          </div>
          <Button.AsChild
            size="sm"
            variant="outline"
            className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
          >
            <a href={`mailto:${accountCopy.footer.supportEmail}`}>
              {gettingStarted.support.cta}
            </a>
          </Button.AsChild>
        </div>
      </div>
    </section>
  );
}
