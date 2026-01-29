"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CardStackIcon,
  DashboardIcon,
  GearIcon,
  LaptopIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@radix-ui/react-icons";
import { ThemeToggle, TrailLogo, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { useUiStore } from "@/src/store/useUiStore";

const navItems = [
  { href: "/dashboard", label: accountCopy.nav.dashboard, icon: DashboardIcon },
  { href: "/settings", label: accountCopy.nav.settings, icon: GearIcon },
  { href: "/billing", label: accountCopy.nav.billing, icon: CardStackIcon },
  { href: "/extension", label: accountCopy.nav.extension, icon: LaptopIcon }
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "flex flex-col gap-6 rounded-3xl border border-border/60 bg-surface/85 p-4 shadow-elev-1 lg:sticky lg:top-6",
        sidebarCollapsed && "lg:items-center"
      )}
    >
      <div className={cn("flex items-center justify-between", sidebarCollapsed && "lg:flex-col lg:gap-3")}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-surface shadow-card">
            <TrailLogo className="trail-logo--sm" />
          </span>
          <span
            className={cn(
              "text-sm font-semibold text-ink",
              sidebarCollapsed && "lg:sr-only"
            )}
          >
            Trail
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-ink transition hover:bg-surface-high",
            sidebarCollapsed && "lg:order-first"
          )}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      <nav className={cn("grid gap-1", sidebarCollapsed && "lg:place-items-center")}
      >
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-ink text-surface shadow-card"
                  : "text-ink-muted hover:bg-surface-high hover:text-ink",
                sidebarCollapsed && "lg:justify-center lg:px-2"
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4" />
              <span className={cn(sidebarCollapsed && "lg:sr-only")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "mt-auto flex items-center justify-between gap-3 text-xs text-ink-muted",
          sidebarCollapsed && "lg:flex-col"
        )}
      >
        <a
          href="/auth/logout"
          className={cn(
            "rounded-full border border-transparent px-3 py-1 transition hover:border-border/60 hover:text-ink",
            sidebarCollapsed && "lg:sr-only"
          )}
        >
          {accountCopy.nav.signOut}
        </a>
        <ThemeToggle />
      </div>
    </aside>
  );
}
