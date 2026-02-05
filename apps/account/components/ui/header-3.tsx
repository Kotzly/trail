"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@trail/ui";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { accountCopy } from "@trail/content";
import { TrailLogo } from "@trail/ui";
import { trpc } from "@/src/trpc/client";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";

type LinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

const pageMeta: Array<{
  href: string;
  meta: { title: string; cta?: { label: string; href: string } };
}> = [
  {
    href: "/dashboard",
    meta: {
      title: accountCopy.dashboard.title,
      cta: { label: accountCopy.dashboard.cta, href: "/extension" },
    },
  },
  {
    href: "/settings",
    meta: {
      title: accountCopy.settings.title,
      cta: { label: accountCopy.settings.cta, href: "/settings#profile" },
    },
  },
  {
    href: "/billing",
    meta: {
      title: accountCopy.billing.title,
      cta: { label: accountCopy.billing.cta, href: "/billing" },
    },
  },
  {
    href: "/extension",
    meta: {
      title: accountCopy.extension.title,
      cta: { label: accountCopy.extension.cta, href: "/extension" },
    },
  },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const scrolled = useScroll(10);
  const prefersReducedMotion = useReducedMotion();
  const health = trpc.health.useQuery(undefined, { refetchInterval: 30000 });
  const me = trpc.me.useQuery();

  const active = pageMeta.find((item) => pathname.startsWith(item.href))
    ?.meta ?? {
    title: accountCopy.meta.title,
  };

  const displayName =
    me.data?.user?.name?.trim() ||
    me.data?.user?.email?.split("@")[0] ||
    accountCopy.settings.profile.fallbackName;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toLowerCase())
    .join("");

  const statusLabel = health.data?.ok
    ? accountCopy.dashboard.status.online
    : accountCopy.dashboard.status.checking;
  const statusTone = health.data?.ok ? "bg-emerald-500" : "bg-amber-400";

  const navLinks: LinkItem[] = [
    {
      title: accountCopy.nav.dashboard,
      href: "/dashboard",
      description: accountCopy.header.navItems.dashboard,
      icon: LayoutDashboard,
    },
    {
      title: accountCopy.nav.extension,
      href: "/extension",
      description: accountCopy.header.navItems.extension,
      icon: Plug,
    },
    {
      title: accountCopy.nav.settings,
      href: "/settings",
      description: accountCopy.header.navItems.settings,
      icon: Settings,
    },
    {
      title: accountCopy.nav.billing,
      href: "/billing",
      description: accountCopy.header.navItems.billing,
      icon: CreditCard,
    },
  ];

  const userLinks: LinkItem[] = [
    {
      title: accountCopy.header.userMenu.settings,
      href: "/settings",
      description: accountCopy.header.userMenu.settingsDescription,
      icon: User,
    },
    {
      title: accountCopy.header.userMenu.signOut,
      href: "/auth/logout",
      description: accountCopy.header.userMenu.signOutDescription,
      icon: LogOut,
    },
  ];

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent transition",
        scrolled && "border-border/60 bg-bg/95",
      )}
    >
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 transition hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <TrailLogo className="h-6 w-6" />
            <span className="sr-only">{accountCopy.meta.title}</span>
          </Link>
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
                  {accountCopy.header.navLabel}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-bg p-1.5">
                  <ul className="grid w-[460px] grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-surface p-2 shadow-elev-2">
                    {navLinks.map((item) => (
                      <li key={item.href}>
                        <ListItem {...item} />
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="hidden flex-1 items-center justify-center px-6 lg:flex">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder={accountCopy.header.searchPlaceholder}
              className="trail-input pr-16"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border/60 px-2 py-0.5 text-[0.65rem] text-ink-muted">
              {accountCopy.header.searchHint}
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs text-ink-muted">
            <span className={cn("h-2 w-2 rounded-full", statusTone)} />
            <span>{statusLabel}</span>
          </div>
          {active.cta ? (
            <Button.AsChild size="sm" variant="outline">
              <Link href={active.cta.href}>{active.cta.label}</Link>
            </Button.AsChild>
          ) : null}
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent px-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-surface text-xs font-semibold text-ink">
                    {initials}
                  </span>
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-bg p-1.5">
                  <ul className="w-[240px] space-y-1 rounded-2xl border border-border/60 bg-surface p-2 shadow-elev-2">
                    {userLinks.map((item) => (
                      <li key={item.href}>
                        <ListItem {...item} className="rounded-xl" />
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={accountCopy.header.mobileToggleLabel}
        >
          <MenuToggleIcon
            open={open}
            className="size-5"
            duration={prefersReducedMotion ? 0 : 300}
          />
        </Button>
      </nav>

      <MobileMenu open={open} className="flex flex-col justify-between gap-6">
        <div className="flex flex-col gap-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
            {accountCopy.header.navLabel}
          </div>
          <div className="flex flex-col gap-2">
            {navLinks.map((item) => (
              <MobileLink
                key={item.href}
                {...item}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {active.cta ? (
            <Button.AsChild size="sm" className="w-full">
              <Link href={active.cta.href}>{active.cta.label}</Link>
            </Button.AsChild>
          ) : null}
          <Button.AsChild size="sm" variant="outline" className="w-full">
            <Link href="/settings">{accountCopy.header.userMenu.settings}</Link>
          </Button.AsChild>
          <Button.AsChild size="sm" variant="ghost" className="w-full">
            <Link href="/auth/logout">
              {accountCopy.header.userMenu.signOut}
            </Link>
          </Button.AsChild>
        </div>
      </MobileMenu>
    </header>
  );
}

type MobileMenuProps = React.ComponentProps<"div"> & {
  open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        "fixed inset-0 z-[60] flex flex-col border-y border-border/60 bg-bg/95 lg:hidden",
      )}
    >
      <div
        data-slot={open ? "open" : "closed"}
        className={cn(
          "size-full p-6 data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 motion-reduce:animate-none motion-reduce:transform-none",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ListItem({
  title,
  description,
  icon: Icon,
  className,
  href,
  ...props
}: React.ComponentProps<typeof NavigationMenuLink> & LinkItem) {
  return (
    <NavigationMenuLink
      className={cn(
        "flex w-full gap-3 rounded-xl p-2 transition hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
      {...props}
      asChild
    >
      <Link href={href}>
        <div className="flex size-12 items-center justify-center rounded-xl border border-border/60 bg-bg">
          <Icon className="size-5 text-ink" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-sm font-semibold lowercase text-ink">
            {title}
          </span>
          {description ? (
            <span className="text-xs text-ink-muted">{description}</span>
          ) : null}
        </div>
      </Link>
    </NavigationMenuLink>
  );
}

function MobileLink({
  title,
  description,
  icon: Icon,
  href,
  onClick,
}: LinkItem & { onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/90 p-3 transition hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-bg">
        <Icon className="size-5 text-ink" />
      </div>
      <div>
        <div className="text-sm font-semibold lowercase text-ink">{title}</div>
        {description ? (
          <div className="text-xs text-ink-muted">{description}</div>
        ) : null}
      </div>
    </Link>
  );
}

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  React.useEffect(() => {
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  React.useEffect(() => {
    onScroll();
  }, [onScroll]);

  return scrolled;
}
