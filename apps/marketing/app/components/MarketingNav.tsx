"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { ThemeToggle, TrailLogo } from "@trail/ui";

export function MarketingNav() {
  const { nav } = marketingCopy;
  const [isOpen, setIsOpen] = React.useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/40 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-display font-semibold tracking-tight text-ink"
          onClick={closeMenu}
        >
          <span className="trail-card-compact flex h-9 w-9 items-center justify-center bg-surface">
            <TrailLogo className="trail-logo--sm" />
          </span>
          trail
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink-subtle md:flex">
          <Link href="/#features" className="transition hover:text-ink">
            {nav.features}
          </Link>
          <Link href="/#workflow" className="transition hover:text-ink">
            {nav.workflow}
          </Link>
          <Link href="/faq" className="transition hover:text-ink">
            {nav.faq}
          </Link>
          <Link href="/support" className="transition hover:text-ink">
            {nav.support}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle className="border-stroke/50 bg-surface/70 text-ink hover:bg-surface-strong" />
          <a
            href="https://app.gettrail.net/auth/login"
            className="hidden rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke md:inline-flex"
          >
            {nav.signIn}
          </a>
          <Link
            href="/downloads"
            className="cta-primary hidden rounded-full bg-ink px-4 py-2 text-sm font-medium shadow-elev-1 transition hover:bg-ink-muted md:inline-flex"
          >
            {nav.getStarted}
          </Link>
          <button
            type="button"
            aria-controls="marketing-mobile-menu"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke/50 bg-surface/70 text-ink transition hover:bg-surface-strong md:hidden"
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
      {isOpen ? (
        <div
          id="marketing-mobile-menu"
          className="border-t border-stroke/40 bg-base/95 px-6 pb-6 pt-4 md:hidden"
        >
          <nav className="flex flex-col gap-4 text-sm font-medium text-ink">
            <Link href="/#features" onClick={closeMenu}>
              {nav.features}
            </Link>
            <Link href="/#workflow" onClick={closeMenu}>
              {nav.workflow}
            </Link>
            <Link href="/faq" onClick={closeMenu}>
              {nav.faq}
            </Link>
            <Link href="/support" onClick={closeMenu}>
              {nav.support}
            </Link>
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href="https://app.gettrail.net/auth/login"
              className="inline-flex items-center justify-center rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink"
            >
              {nav.signIn}
            </a>
            <Link
              href="/downloads"
              className="cta-primary inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-ink-inverse shadow-elev-1"
              onClick={closeMenu}
            >
              {nav.getStarted}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
