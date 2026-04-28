import Link from "next/link";
import { MarkdownBlocks } from "./MarkdownBlocks";

type RelatedDoc = { label: string; href: string };

export function LegalShell({
  eyebrow,
  title,
  lastUpdated,
  markdown,
  related,
  contactEmail = "support@gettrail.net",
}: {
  eyebrow: string;
  title: string;
  lastUpdated?: string;
  markdown: string;
  related?: RelatedDoc;
  contactEmail?: string;
}) {
  return (
    <section
      className="relative mx-auto max-w-[920px]"
      style={{
        padding: "clamp(64px, 10vh, 120px) clamp(24px, 6vw, 96px) 120px",
      }}
    >
      <header className="mb-14 max-w-[640px]">
        <div
          className="font-mono uppercase mb-[22px]"
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--landing-ember)",
          }}
        >
          {eyebrow}
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
          {title}
        </h1>
        {lastUpdated ? (
          <p
            className="font-mono uppercase mt-6"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(246,239,225,0.45)",
            }}
          >
            Last updated · {lastUpdated}
          </p>
        ) : null}
      </header>

      <div className="border-t border-[var(--landing-line)] pt-10">
        <MarkdownBlocks markdown={markdown} />
      </div>

      <footer
        className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--landing-line)] pt-6 font-mono uppercase"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.18em",
          color: "rgba(246,239,225,0.42)",
        }}
      >
        {related ? (
          <Link
            href={related.href}
            className="transition-colors duration-200 hover:text-[var(--landing-ink)]"
          >
            {related.label}
          </Link>
        ) : null}
        <a
          href={`mailto:${contactEmail}`}
          className="transition-colors duration-200 hover:text-[var(--landing-ink)]"
        >
          {contactEmail}
        </a>
      </footer>
    </section>
  );
}
