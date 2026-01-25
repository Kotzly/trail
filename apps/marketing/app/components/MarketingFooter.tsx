import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/40 bg-surface/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
        <span>© 2026 Trail. All rights reserved.</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/faq">FAQ</Link>
          <a href="https://my.gettrail.net">Account</a>
          <a href="mailto:hello@gettrail.net">hello@gettrail.net</a>
        </div>
      </div>
    </footer>
  );
}
