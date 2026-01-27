import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-stroke/40 bg-base/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-ink-subtle md:flex-row md:items-center md:justify-between">
        <span>trail © {new Date().getFullYear()}</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/faq">FAQ</Link>
          <a href="https://my.gettrail.net">Account</a>
          <a href="mailto:support@gettrail.net">support@gettrail.net</a>
        </div>
      </div>
    </footer>
  );
}
