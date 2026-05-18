import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TrailMark } from "./TrailMark";
import { NewsletterSignup } from "./NewsletterSignup";

export async function LandingFooter({
  contactEmail = "hello@gettrail.net",
  copyright,
}: {
  contactEmail?: string;
  copyright?: string;
} = {}) {
  const t = await getTranslations("footer");
  const tLinks = await getTranslations("footer.links");
  const tCols = await getTranslations("footer.columns");

  const COLUMNS: Array<{
    label: string;
    links: Array<{ label: string; href: string; external?: boolean }>;
  }> = [
    {
      label: tCols("product"),
      links: [
        { label: tLinks("features"), href: "/#features" },
        { label: tLinks("tryIt"), href: "/#try" },
      ],
    },
    {
      label: tCols("help"),
      links: [
        { label: tLinks("support"), href: "/support" },
        { label: tLinks("status"), href: "/support" },
        { label: tLinks("contact"), href: `mailto:${contactEmail}` },
      ],
    },
    {
      label: tCols("legal"),
      links: [
        { label: tLinks("privacy"), href: "/privacy" },
        { label: tLinks("terms"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer
      className="border-t border-[var(--landing-line)] bg-[var(--landing-bg)]"
      style={{
        padding: "72px clamp(24px, 6vw, 96px) 36px",
        color: "rgba(246,239,225,0.55)",
        fontSize: 13,
      }}
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr] lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_1.4fr]">
        {/* Brand block */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <TrailMark size={36} />
            <div>
              <div
                className="font-serif font-medium leading-none text-[var(--landing-ink)]"
                style={{ fontSize: 22 }}
              >
                Trail
              </div>
              <div
                className="font-mono uppercase mt-1.5"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  color: "rgba(246,239,225,0.42)",
                }}
              >
                {t("tagline")}
              </div>
            </div>
          </div>
          <p
            className="max-w-[280px]"
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "rgba(246, 239, 225, 0.55)",
            }}
          >
            {t("blurb")}
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex w-fit items-center gap-2 rounded-full font-mono transition-colors duration-200 hover:bg-[rgba(246,239,225,0.04)] hover:text-[var(--landing-ink)]"
            style={{
              fontSize: 12,
              letterSpacing: "0.06em",
              color: "rgba(246,239,225,0.7)",
              padding: "8px 14px",
              border: "1px solid var(--landing-line-strong)",
            }}
          >
            {contactEmail}
          </a>
        </div>

        {/* Link columns */}
        {COLUMNS.map((col) => (
          <div key={col.label} className="flex flex-col gap-3">
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "rgba(246,239,225,0.4)",
              }}
            >
              {col.label}
            </div>
            <ul className="flex flex-col gap-2">
              {col.links.map((l) => {
                const isInternal = l.href.startsWith("/") && !l.external;
                const className =
                  "text-[13.5px] leading-[1.4] text-[rgba(246,239,225,0.7)] transition-colors duration-200 hover:text-[var(--landing-ink)]";
                return (
                  <li key={l.label}>
                    {isInternal ? (
                      <Link href={l.href} className={className}>
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className={className}>
                        {l.label}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="sm:col-span-full lg:col-span-1">
          <NewsletterSignup />
        </div>
      </div>

      {/* Bottom row */}
      <div
        className="mx-auto mt-16 flex max-w-[1280px] flex-wrap items-center justify-between gap-3.5 border-t border-[var(--landing-line)] pt-6 font-mono uppercase"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          color: "rgba(246,239,225,0.36)",
        }}
      >
        <span>
          {copyright ?? t("copyright", { year: new Date().getFullYear() })}
        </span>
        <span>{t("bottomNote")}</span>
      </div>
    </footer>
  );
}
