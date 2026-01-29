import Link from "next/link";

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-border/60 bg-bg px-4 py-3 text-xs text-ink-muted lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <a href="mailto:support@gettrail.net" className="text-ink transition hover:text-ink">
            support@gettrail.net
          </a>
          <span className="text-ink-muted">•</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            status: all systems normal
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/settings" className="transition hover:text-ink">
            account
          </Link>
          <Link href="/billing" className="transition hover:text-ink">
            billing
          </Link>
          <Link href="/extension" className="transition hover:text-ink">
            extension
          </Link>
        </div>
      </div>
    </footer>
  );
}
