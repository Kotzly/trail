import Link from "next/link";

export interface FooterLink {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface MarketingFooterProps {
  appBaseUrl?: string;
  links?: FooterLink[];
  copyright?: string;
}

const defaultLinks: FooterLink[] = [
  { label: "FAQ", href: "/faq" },
  { label: "Support", href: "/support" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export function MarketingFooter({
  links,
  copyright = "Trail",
}: MarketingFooterProps) {
  const resolvedLinks = links ?? defaultLinks;

  return (
    <footer className="border-t border-stroke/40 bg-base/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-ink-subtle md:flex-row md:items-center md:justify-between">
        <span>
          {copyright} © {new Date().getFullYear()}
        </span>
        <div className="flex flex-wrap gap-4">
          {resolvedLinks.map((link) => {
            const isExternal =
              link.isExternal || link.href.startsWith("http") || link.href.startsWith("mailto:");

            if (isExternal) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  {link.label}
                </a>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
