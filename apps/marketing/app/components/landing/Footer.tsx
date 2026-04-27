import Link from "next/link";
import { TrailMark } from "./TrailMark";

const COLUMNS: Array<{
  label: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    label: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Try it", href: "#try" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    label: "Help",
    links: [
      { label: "Support", href: "/support" },
      { label: "Status", href: "/support" },
      { label: "Contact", href: "mailto:hello@gettrail.net" },
    ],
  },
  {
    label: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function LandingFooter({
  contactEmail = "hello@gettrail.net",
}: {
  contactEmail?: string;
}) {
  return (
    <footer
      className="border-t border-[var(--landing-line)] bg-[var(--landing-bg)]"
      style={{
        padding: "72px clamp(24px, 6vw, 96px) 36px",
        color: "rgba(246,239,225,0.55)",
        fontSize: 13,
      }}
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
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
                Your browsing, mapped
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
            A Chrome extension that turns every tab, click, and detour into a
            living tree.
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
        <span>© 2026 Trail. All roots reserved.</span>
        <span>Made local-first, on purpose.</span>
      </div>
    </footer>
  );
}
