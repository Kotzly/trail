import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { publicEnv } from "@/lib/public-env";

export function MarketingFooter() {
  const { footer } = marketingCopy;
  const appBaseUrl = publicEnv.NEXT_PUBLIC_APP_URL;

  return (
    <footer className="border-t border-stroke/40 bg-base/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-ink-subtle md:flex-row md:items-center md:justify-between">
        <span>
          {footer.copyright} © {new Date().getFullYear()}
        </span>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/faq"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.faq}
          </Link>
          <Link
            href="/support"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.support}
          </Link>
          <Link
            href="/about"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.about}
          </Link>
          <Link
            href="/contact"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.contact}
          </Link>
          <Link
            href="/privacy"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.privacy}
          </Link>
          <Link
            href="/terms"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.terms}
          </Link>
          <a
            href={appBaseUrl}
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.signIn}
          </a>
          <a
            href={`mailto:${footer.links.email}`}
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {footer.links.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
