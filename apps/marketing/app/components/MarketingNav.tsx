"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { ThemeToggle, TrailLogo } from "@trail/ui";

export function MarketingNav() {
  const { nav } = marketingCopy;
  const [isOpen, setIsOpen] = React.useState(false);
  const linkTabIndex = isOpen ? 0 : -1;

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/40 bg-base/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-full text-lg font-display font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          onClick={closeMenu}
        >
          <span className="trail-card-compact flex h-9 w-9 items-center justify-center bg-surface">
            <TrailLogo className="trail-logo--sm" />
          </span>
          trail
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink-subtle md:flex">
          <Link
            href="/#features"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.features}
          </Link>
          <Link
            href="/pricing"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.pricing}
          </Link>
          <Link
            href="/faq"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.faq}
          </Link>
          <Link
            href="/support"
            className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.support}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle className="border-stroke/50 bg-surface/70 text-ink hover:bg-surface-strong" />
          <a
            href="https://app.gettrail.net"
            className="hidden rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base md:inline-flex"
          >
            {nav.signIn}
          </a>
          <Link
            href="/downloads"
            className="cta-primary hidden rounded-full bg-cta px-4 py-2 text-sm font-medium text-cta-fg transition hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base md:inline-flex"
          >
            {nav.getStarted}
          </Link>
          <button
            type="button"
            aria-controls="marketing-mobile-menu"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke/50 bg-surface/70 text-ink transition hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base md:hidden"
          >
            <span className="sr-only">Toggle menu</span>
            {isOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <div
        id="marketing-mobile-menu"
        aria-hidden={!isOpen}
        className={`border-t border-stroke/40 bg-base px-6 md:hidden ${
          isOpen
            ? "max-h-[520px] translate-y-0 pb-6 pt-4 opacity-100"
            : "max-h-0 -translate-y-2 pb-0 pt-0 opacity-0"
        } overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none`}
      >
        <nav className="flex flex-col gap-4 text-sm font-medium text-ink">
          <Link
            href="/#features"
            onClick={closeMenu}
            tabIndex={linkTabIndex}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.features}
          </Link>
          <Link
            href="/pricing"
            onClick={closeMenu}
            tabIndex={linkTabIndex}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.pricing}
          </Link>
          <Link
            href="/faq"
            onClick={closeMenu}
            tabIndex={linkTabIndex}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.faq}
          </Link>
          <Link
            href="/support"
            onClick={closeMenu}
            tabIndex={linkTabIndex}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {nav.support}
          </Link>
        </nav>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href="https://app.gettrail.net"
            className="inline-flex items-center justify-center rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            tabIndex={linkTabIndex}
          >
            {nav.signIn}
          </a>
          <Link
            href="/downloads"
            className="cta-primary inline-flex items-center justify-center rounded-full bg-cta px-4 py-2 text-sm font-medium text-cta-fg transition hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            onClick={closeMenu}
            tabIndex={linkTabIndex}
          >
            {nav.getStarted}
          </Link>
        </div>
      </div>
    </header>
  );
}
