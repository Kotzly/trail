import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { ThemeToggle } from "@trail/ui";

export function MarketingNav() {
  const { nav } = marketingCopy;

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/40 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-display font-semibold tracking-tight text-ink"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-stroke/40 bg-surface shadow-card">
            <span className="text-xs font-semibold uppercase">t</span>
          </span>
          trail
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink-subtle md:flex">
          <a href="#features" className="transition hover:text-ink">
            {nav.features}
          </a>
          <a href="#workflow" className="transition hover:text-ink">
            {nav.workflow}
          </a>
          <Link href="/faq" className="transition hover:text-ink">
            {nav.faq}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle className="border-stroke/50 bg-surface/70 text-ink hover:bg-surface-strong" />
          <a
            href="https://my.gettrail.net"
            className="hidden rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke md:inline-flex"
          >
            {nav.signIn}
          </a>
          <a
            href="https://my.gettrail.net"
            className="cta-primary hidden rounded-full bg-ink px-4 py-2 text-sm font-medium shadow-card transition hover:bg-ink-muted md:inline-flex"
          >
            {nav.getStarted}
          </a>
        </div>
      </div>
    </header>
  );
}
