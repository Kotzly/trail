import Link from "next/link";

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-ink-muted">
      <div className="flex flex-wrap items-center gap-3">
        <a href="mailto:support@gettrail.net" className="text-ink transition hover:text-ink">
          support@gettrail.net
        </a>
        <span className="text-ink-muted">•</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Status: All systems normal
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/settings" className="transition hover:text-ink">
          Account
        </Link>
        <Link href="/billing" className="transition hover:text-ink">
          Billing
        </Link>
        <Link href="/extension" className="transition hover:text-ink">
          Extension
        </Link>
      </div>
    </footer>
  );
}
