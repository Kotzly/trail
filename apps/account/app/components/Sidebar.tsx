"use client";

import * as React from "react";
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

const MIN_WIDTH = 200;
const MAX_WIDTH = 320;
const COLLAPSE_THRESHOLD = 140;

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    sidebarWidth,
    sidebarMobileOpen,
    setSidebarWidth,
    setSidebarCollapsed,
    toggleSidebar,
    toggleSidebarMobile,
    setSidebarMobileOpen
  } = useUiStore();
  const [isDesktop, setIsDesktop] = React.useState(false);
  const dragState = React.useRef<{ startX: number; startWidth: number } | null>(
    null
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  React.useEffect(() => {
    setSidebarMobileOpen(false);
  }, [pathname, setSidebarMobileOpen]);

  const handleToggle = () => {
    if (isDesktop) {
      toggleSidebar();
      return;
    }
    toggleSidebarMobile();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop) {
      return;
    }
    event.preventDefault();
    dragState.current = {
      startX: event.clientX,
      startWidth: sidebarCollapsed ? MIN_WIDTH : sidebarWidth
    };
    setSidebarCollapsed(false);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragState.current) {
        return;
      }
      const delta = moveEvent.clientX - dragState.current.startX;
      const nextWidth = Math.min(
        Math.max(dragState.current.startWidth + delta, MIN_WIDTH),
        MAX_WIDTH
      );

      if (nextWidth <= COLLAPSE_THRESHOLD) {
        setSidebarCollapsed(true);
        return;
      }

      setSidebarCollapsed(false);
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <>
      {sidebarMobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
          aria-label="close sidebar"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[78vw] max-w-[280px] flex-col gap-4 border-r border-border/40 bg-bg px-4 py-4 transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-auto lg:max-w-none lg:border-r",
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
        style={
          isDesktop
            ? { width: sidebarCollapsed ? 72 : sidebarWidth }
            : undefined
        }
      >
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <TrailLogo className="h-8 w-8" />
            <span
              className={cn(
                "text-sm font-semibold lowercase text-ink",
                sidebarCollapsed && "lg:sr-only"
              )}
            >
              trail
            </span>
          </Link>
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-ink transition hover:bg-surface-high"
            aria-label={sidebarCollapsed ? "expand sidebar" : "collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-surface/60 text-ink"
                    : "text-ink-muted hover:bg-surface/50 hover:text-ink",
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
            "flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs text-ink-muted",
            sidebarCollapsed && "lg:flex-col"
          )}
        >
          <a
            href="/auth/logout"
            className={cn(
              "rounded-full border border-transparent px-2 py-1 transition hover:border-border/60 hover:text-ink",
              sidebarCollapsed && "lg:sr-only"
            )}
          >
            {accountCopy.nav.signOut}
          </a>
          <ThemeToggle />
        </div>

        <div
          onPointerDown={handlePointerDown}
          className="absolute right-0 top-0 hidden h-full w-2 translate-x-1/2 cursor-col-resize lg:block"
          aria-hidden="true"
        />
      </aside>
    </>
  );
}
