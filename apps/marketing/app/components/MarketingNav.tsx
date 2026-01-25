import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { Button, ThemeToggle } from "@trail/ui";

export function MarketingNav() {
  const { nav } = marketingCopy;

  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.2em]">
          TRAIL
        </Link>
        <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.25em] text-ink-muted md:flex">
          <a href="#product">{nav.product}</a>
          <a href="#how">{nav.howItWorks}</a>
          <a href="#security">{nav.security}</a>
          <Link href="/faq">{nav.faq}</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="https://my.gettrail.net">{nav.signIn}</Link>
          </Button>
          <Button asChild className="hidden md:inline-flex">
            <Link href="https://my.gettrail.net">{nav.getStarted}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
