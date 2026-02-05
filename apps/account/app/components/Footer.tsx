import Link from "next/link";
import { accountCopy } from "@trail/content";

export function Footer() {
  const { footer } = accountCopy;

  return (
    <footer className="border-t border-border/60 bg-bg/70 px-4 py-4 text-xs text-ink-muted backdrop-blur lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${footer.supportEmail}`}
            className="text-ink transition hover:text-ink"
          >
            {footer.supportEmail}
          </a>
          <span className="text-ink-muted">•</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {footer.statusText}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/settings" className="transition hover:text-ink">
            {accountCopy.nav.settings}
          </Link>
          <Link href="/billing" className="transition hover:text-ink">
            {accountCopy.nav.billing}
          </Link>
          <Link href="/extension" className="transition hover:text-ink">
            {accountCopy.nav.extension}
          </Link>
        </div>
      </div>
    </footer>
  );
}
