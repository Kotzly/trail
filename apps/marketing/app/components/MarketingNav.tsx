import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { ThemeToggle, TrailLogo } from "@trail/ui";

export function MarketingNav() {
  const { nav } = marketingCopy;

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/40 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-display font-semibold tracking-tight text-ink"
        >
          <span className="trail-card-compact flex h-9 w-9 items-center justify-center bg-surface shadow-card">
            <TrailLogo className="trail-logo--sm" />
          </span>
          trail
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink-subtle md:flex">
          <Link href="/#features" className="transition hover:text-ink">
            {nav.features}
          </Link>
          <Link href="/#workflow" className="transition hover:text-ink">
            {nav.workflow}
          </Link>
          <Link href="/faq" className="transition hover:text-ink">
            {nav.faq}
          </Link>
          <Link href="/support" className="transition hover:text-ink">
            {nav.support}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle className="border-stroke/50 bg-surface/70 text-ink hover:bg-surface-strong" />
          <a
            href="https://app.gettrail.net/auth/login"
            className="hidden rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke md:inline-flex"
          >
            {nav.signIn}
          </a>
          <Link
            href="/downloads"
            className="cta-primary hidden rounded-full bg-ink px-4 py-2 text-sm font-medium shadow-card transition hover:bg-ink-muted md:inline-flex"
          >
            {nav.getStarted}
          </Link>
        </div>
      </div>
    </header>
  );
}
