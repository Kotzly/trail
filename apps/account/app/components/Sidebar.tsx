"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountCopy } from "@trail/content";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  Activity,
  Compass,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Shield,
} from "lucide-react";
import { cn, TrailLogo } from "@trail/ui";

const navLinks = [
  {
    label: accountCopy.nav.dashboard,
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" />,
  },
  {
    label: accountCopy.nav.activity,
    href: "/activity",
    icon: <Activity className="h-5 w-5 flex-shrink-0" />,
  },
  {
    label: accountCopy.nav.gettingStarted,
    href: "/getting-started",
    icon: <Compass className="h-5 w-5 flex-shrink-0" />,
  },
  {
    label: accountCopy.nav.sessions,
    href: "/sessions",
    icon: <Shield className="h-5 w-5 flex-shrink-0" />,
  },
  {
    label: accountCopy.nav.extension,
    href: "/extension",
    icon: <Plug className="h-5 w-5 flex-shrink-0" />,
  },
  {
    label: accountCopy.nav.settings,
    href: "/settings",
    icon: <Settings className="h-5 w-5 flex-shrink-0" />,
  },
  {
    label: accountCopy.nav.billing,
    href: "/billing",
    icon: <CreditCard className="h-5 w-5 flex-shrink-0" />,
  },
];

function Logo({ isOpen }: { isOpen: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex items-center gap-2 text-sm text-ink py-1 relative z-20 h-10"
    >
      <div className="h-8 w-8 flex items-center justify-center border border-border/60 bg-surface rounded-xl flex-shrink-0">
        <TrailLogo className="h-5 w-5" />
      </div>
      <span
        className={cn(
          "font-medium text-ink whitespace-pre lowercase text-base transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
        )}
      >
        {accountCopy.brand.name}
      </span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Sidebar open={isHovered} setOpen={setIsHovered}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <Logo isOpen={isHovered} />

            <div className="mt-6 flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <SidebarLink
                    key={link.href}
                    link={link}
                    className={cn(isActive && "bg-surface-high text-ink")}
                  />
                );
              })}
            </div>
          </div>
          <div className="border-t border-border/60 pt-4">
            <SidebarLink
              link={{
                label: accountCopy.nav.signOut,
                href: "/auth/logout",
                icon: <LogOut className="h-5 w-5 flex-shrink-0" />,
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
    </div>
  );
}
