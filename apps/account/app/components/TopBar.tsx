"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  MagnifyingGlassIcon
} from "@radix-ui/react-icons";
import { Button, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { trpc } from "@/src/trpc/client";
import { useUiStore } from "@/src/store/useUiStore";

type PageMeta = {
  title: string;
  cta?: { label: string; href: string };
};

const pageMeta: Array<{ href: string; meta: PageMeta }> = [
  {
    href: "/dashboard",
    meta: {
      title: accountCopy.dashboard.title,
      cta: { label: accountCopy.dashboard.cta, href: "/extension" }
    }
  },
  {
    href: "/settings",
    meta: {
      title: accountCopy.settings.title,
      cta: { label: accountCopy.settings.cta, href: "/settings#profile" }
    }
  },
  {
    href: "/billing",
    meta: {
      title: accountCopy.billing.title,
      cta: { label: accountCopy.billing.cta, href: "/billing" }
    }
  },
  {
    href: "/extension",
    meta: {
      title: accountCopy.extension.title,
      cta: { label: accountCopy.extension.cta, href: "/extension" }
    }
  }
];

export function TopBar() {
  const pathname = usePathname();
  const health = trpc.health.useQuery(undefined, { refetchInterval: 30000 });
  const me = trpc.me.useQuery();
  const { sidebarCollapsed, toggleSidebar, toggleSidebarMobile } = useUiStore();

  const active = pageMeta.find((item) => pathname.startsWith(item.href))?.meta ?? {
    title: "account"
  };

  const displayName =
    me.data?.user?.name?.trim() ||
    me.data?.user?.email?.split("@")[0] ||
    "trail member";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toLowerCase())
    .join("");

  const statusLabel = health.data?.ok ? "sync ready" : "sync checking";
  const statusTone = health.data?.ok ? "bg-emerald-500" : "bg-amber-400";

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth >= 1024) {
              toggleSidebar();
              return;
            }
            toggleSidebarMobile();
          }}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-ink transition hover:bg-surface-high",
            sidebarCollapsed && "lg:rotate-180"
          )}
          aria-label="toggle sidebar"
        >
          <ChevronLeftIcon />
        </button>

        <div className="min-w-0">
          <p className="text-xs text-ink-muted">account / {active.title}</p>
          <h1 className="truncate text-lg font-semibold lowercase text-ink sm:text-xl">
            {active.title}
          </h1>
        </div>

        <div className="hidden flex-1 items-center md:flex">
          <div className="relative w-full max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder={accountCopy.header.searchPlaceholder}
              className="h-10 w-full rounded-full border border-border/60 bg-surface/70 pl-10 pr-16 text-sm text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border/60 px-2 py-0.5 text-[0.65rem] text-ink-muted">
              {accountCopy.header.searchHint}
            </span>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs text-ink-muted">
            <span className={cn("h-2 w-2 rounded-full", statusTone)} />
            <span>{statusLabel}</span>
          </div>
          {active.cta ? (
            <Button asChild size="sm" variant="outline">
              <Link href={active.cta.href}>
                {active.cta.label}
                <ArrowRightIcon />
              </Link>
            </Button>
          ) : null}
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface text-xs font-semibold text-ink">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
