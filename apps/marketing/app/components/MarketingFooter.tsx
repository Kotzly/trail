import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-stroke/40 bg-base/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-ink-subtle md:flex-row md:items-center md:justify-between">
        <span>trail © {new Date().getFullYear()}</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/faq">FAQ</Link>
          <Link href="/support">Support</Link>
          <Link href="https://www.gettrail.net/privacy">Privacy Policy</Link>
          <Link href="https://www.gettrail.net/terms">Terms of Service</Link>
          <a href="https://my.gettrail.net/auth/login">Sign in</a>
          <a href="mailto:support@gettrail.net">support@gettrail.net</a>
        </div>
      </div>
    </footer>
  );
}
