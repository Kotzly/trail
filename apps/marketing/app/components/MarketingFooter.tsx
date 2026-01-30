import Link from "next/link";
import { marketingCopy } from "@trail/content";

export function MarketingFooter() {
  const { footer } = marketingCopy;

  return (
    <footer className="border-t border-stroke/40 bg-base/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-ink-subtle md:flex-row md:items-center md:justify-between">
        <span>
          {footer.copyright} © {new Date().getFullYear()}
        </span>
        <div className="flex flex-wrap gap-4">
          <Link href="/faq">{footer.links.faq}</Link>
          <Link href="/support">{footer.links.support}</Link>
          <Link href="/privacy">{footer.links.privacy}</Link>
          <Link href="/terms">{footer.links.terms}</Link>
          <a href="https://app.gettrail.net/auth/login">{footer.links.signIn}</a>
          <a href={`mailto:${footer.links.email}`}>{footer.links.email}</a>
        </div>
      </div>
    </footer>
  );
}
