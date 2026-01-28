"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle, TrailLogo, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { useUiStore } from "@/src/store/useUiStore";

const navItems = [
  { href: "/dashboard", label: accountCopy.nav.dashboard },
  { href: "/settings", label: accountCopy.nav.settings },
  { href: "/billing", label: accountCopy.nav.billing },
  { href: "/extension", label: "Extension" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  return (
    <div
      className={cn(
        "app-shell grid min-h-screen grid-cols-1 gap-6 bg-bg px-6 py-6",
        sidebarOpen ? "lg:grid-cols-[240px_1fr]" : "lg:grid-cols-1"
      )}
    >
      {sidebarOpen ? (
        <aside className="trail-card-soft p-6 shadow-elev-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="trail-card-compact flex h-8 w-8 items-center justify-center bg-surface shadow-card">
                <TrailLogo className="trail-logo--sm" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Trail</span>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-full border border-border/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em]"
            >
              Hide
            </button>
          </div>
          <nav className="mt-10 flex flex-col gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 transition",
                  pathname.startsWith(item.href)
                    ? "bg-ink text-bg"
                    : "text-ink-muted hover:bg-surface-high"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 flex items-center justify-between">
            <a href="/auth/logout" className="text-xs uppercase tracking-[0.3em] text-ink-muted">
              {accountCopy.nav.signOut}
            </a>
            <ThemeToggle />
          </div>
        </aside>
      ) : null}
      <main className="trail-card-muted relative p-8 shadow-elev-1">
        {!sidebarOpen ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink"
          >
            Show menu
          </button>
        ) : null}
        {children}
      </main>
    </div>
  );
}
