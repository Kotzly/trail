import Link from "next/link";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Button, Card, SectionHeader, StepList } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@trail/ui";

export default function GettingStartedPage() {
  const { gettingStarted } = accountCopy;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.gettingStarted}
        title={gettingStarted.title}
        subtitle={gettingStarted.subtitle}
        actions={
          <Button.AsChild size="sm">
            <Link href="/extension" className="inline-flex items-center gap-2">
              {gettingStarted.cta}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            title={gettingStarted.stepsTitle}
            subtitle={gettingStarted.stepsSubtitle}
            actions={
              <span className="trail-pill">{gettingStarted.progress}</span>
            }
          />
          <StepList className="mt-4" steps={gettingStarted.steps} />
        </Card>

        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={gettingStarted.next.eyebrow}
            title={gettingStarted.next.title}
            subtitle={gettingStarted.next.subtitle}
          />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            {gettingStarted.next.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="rounded-[26px] bg-surface/60 px-6 py-5">
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
          <Button.AsChild size="sm" variant="outline">
            <a href={`mailto:${accountCopy.footer.supportEmail}`}>
              {gettingStarted.support.cta}
            </a>
          </Button.AsChild>
        </div>
      </Card>
    </section>
  );
}
