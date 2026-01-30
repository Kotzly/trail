"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountCopy } from "@trail/content";
import { TrailLogo, cn } from "@trail/ui";
import { Sidebar as SidebarRoot, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings
} from "lucide-react";

const navLinks = [
  {
    label: accountCopy.nav.dashboard,
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5 text-ink" />
  },
  {
    label: accountCopy.nav.extension,
    href: "/extension",
    icon: <Plug className="h-5 w-5 text-ink" />
  },
  {
    label: accountCopy.nav.settings,
    href: "/settings",
    icon: <Settings className="h-5 w-5 text-ink" />
  },
  {
    label: accountCopy.nav.billing,
    href: "/billing",
    icon: <CreditCard className="h-5 w-5 text-ink" />
  }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <SidebarRoot animate={false}>
      <SidebarBody showMobile={false} className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-semibold lowercase text-ink transition hover:bg-surface-high"
          >
            <TrailLogo className="h-6 w-6" />
            <span>{accountCopy.brand.name}</span>
          </Link>
          <div className="mt-6 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <SidebarLink
                  key={link.href}
                  link={link}
                  className={cn(
                    "rounded-xl",
                    isActive
                      ? "bg-surface-high text-ink"
                      : "text-ink-muted hover:text-ink"
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 pt-3">
          <SidebarLink
            link={{
              label: accountCopy.nav.signOut,
              href: "/auth/logout",
              icon: <LogOut className="h-5 w-5 text-ink" />
            }}
            className="rounded-xl text-ink-muted hover:text-ink"
          />
        </div>
      </SidebarBody>
    </SidebarRoot>
  );
}
