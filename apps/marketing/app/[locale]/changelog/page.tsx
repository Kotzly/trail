import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildMetadata } from "@/lib/seo";
import { Reveal } from "@/app/components/ui/reveal";
import {
  changelog,
  type ChangelogChangeType,
  type ChangelogEntry,
} from "./entries";

export const dynamic = "force-static";

type ChangelogPageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: ChangelogPageParams;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    title: "Changelog",
    description:
      "New features, improvements, and fixes shipped in Trail — organized by release.",
    path: "/changelog",
    locale,
  });
}

export default async function ChangelogPage({
  params,
}: {
  params: ChangelogPageParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const entries = [...changelog].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-32">
      <Reveal>
        <div className="text-center">
          <span className="inline-block text-xs font-medium uppercase tracking-widest text-text-tertiary">
            Changelog
          </span>
          <h1 className="mt-4 font-serif text-4xl italic leading-tight text-text-primary md:text-5xl">
            What's new in Trail
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-text-secondary leading-relaxed">
            New features, improvements, and fixes — in the order we shipped
            them.
          </p>
        </div>
      </Reveal>

      {entries.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="mt-12 rounded-2xl border border-border-subtle bg-surface p-8 text-center">
            <p className="text-sm text-text-tertiary">
              Nothing to report yet. Check back soon.
            </p>
          </div>
        </Reveal>
      ) : (
        <ol className="mt-12 space-y-6">
          {entries.map((entry, index) => (
            <Reveal key={entry.version} delay={0.05 + index * 0.05}>
              <ChangelogCard entry={entry} locale={locale} />
            </Reveal>
          ))}
        </ol>
      )}
    </section>
  );
}

function ChangelogCard({
  entry,
  locale,
}: {
  entry: ChangelogEntry;
  locale: string;
}) {
  return (
    <li className="rounded-2xl border border-border-subtle bg-surface p-7 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-2xl italic text-text-primary">
            v{entry.version}
          </span>
          {entry.title && (
            <span className="text-sm text-text-secondary">{entry.title}</span>
          )}
        </div>
        <time
          dateTime={entry.date}
          className="text-xs font-medium uppercase tracking-widest text-text-tertiary"
        >
          {formatDate(entry.date, locale)}
        </time>
      </header>

      <ul className="mt-5 space-y-3">
        {entry.changes.map((change, i) => (
          <li key={i} className="flex items-start gap-3">
            <ChangeBadge type={change.type} />
            <p className="flex-1 text-sm leading-relaxed text-text-secondary">
              {change.description}
            </p>
          </li>
        ))}
      </ul>
    </li>
  );
}

const BADGE_STYLES: Record<ChangelogChangeType, string> = {
  added: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  changed: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  fixed: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  removed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const BADGE_LABELS: Record<ChangelogChangeType, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
};

function ChangeBadge({ type }: { type: ChangelogChangeType }) {
  return (
    <span
      className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${BADGE_STYLES[type]}`}
    >
      {BADGE_LABELS[type]}
    </span>
  );
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
