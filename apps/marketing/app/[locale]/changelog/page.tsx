import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildMetadata } from "@/lib/seo";
import { SiteChrome } from "@/app/components/SiteChrome";
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
    <SiteChrome locale={locale}>
      <section
        className="relative mx-auto max-w-[920px]"
        style={{
          padding: "clamp(64px, 10vh, 120px) clamp(24px, 6vw, 96px) 120px",
        }}
      >
        <header className="mb-16 max-w-[640px]">
          <div
            className="font-mono uppercase mb-[22px]"
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--landing-ember)",
            }}
          >
            Changelog
          </div>
          <h1
            className="font-serif text-[var(--landing-ink)]"
            style={{
              fontSize: "clamp(40px, 5.5vw, 72px)",
              fontWeight: 400,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
            }}
          >
            What we shipped, in the order we shipped it.
          </h1>
        </header>

        {entries.length === 0 ? (
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "rgba(246,239,225,0.42)",
            }}
          >
            Nothing to report yet — check back soon.
          </p>
        ) : (
          <ol className="flex flex-col">
            {entries.map((entry, index) => (
              <ChangelogEntryRow
                key={entry.version}
                entry={entry}
                locale={locale}
                isFirst={index === 0}
              />
            ))}
          </ol>
        )}
      </section>
    </SiteChrome>
  );
}

function ChangelogEntryRow({
  entry,
  locale,
  isFirst,
}: {
  entry: ChangelogEntry;
  locale: string;
  isFirst: boolean;
}) {
  return (
    <li
      className={
        isFirst ? "py-12" : "border-t border-[var(--landing-line)] py-12"
      }
    >
      <div className="grid gap-8 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col gap-2">
          <time
            dateTime={entry.date}
            className="font-mono uppercase"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.2em",
              color: "rgba(246,239,225,0.45)",
            }}
          >
            {formatDate(entry.date, locale)}
          </time>
          <span
            className="font-serif text-[var(--landing-ink)]"
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            v{entry.version}
          </span>
          {entry.title ? (
            <span
              style={{
                fontSize: 14,
                color: "rgba(246,239,225,0.6)",
                lineHeight: 1.45,
              }}
            >
              {entry.title}
            </span>
          ) : null}
        </div>

        <ul className="flex flex-col gap-3">
          {entry.changes.map((change, i) => (
            <li
              key={i}
              className="grid gap-x-5 gap-y-1"
              style={{ gridTemplateColumns: "minmax(72px,auto) 1fr" }}
            >
              <span
                className="font-mono uppercase pt-[3px]"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: CHANGE_COLOR[change.type],
                }}
              >
                {CHANGE_LABEL[change.type]}
              </span>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "rgba(246,239,225,0.78)",
                }}
              >
                {change.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

const CHANGE_LABEL: Record<ChangelogChangeType, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
};

// All four labels live in the warm-ember palette family — no rainbow
// status chips. "Removed" reaches for the deep ember (the brand's only
// allowed warning hue); "Added" gets the bright ember as the strongest
// positive signal; the middle two settle into the cream neutrals.
const CHANGE_COLOR: Record<ChangelogChangeType, string> = {
  added: "var(--ember)",
  changed: "rgba(246,239,225,0.85)",
  fixed: "rgba(246,239,225,0.55)",
  removed: "var(--ember-deep)",
};

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
