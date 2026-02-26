"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Map, Settings, PanelLeft, LogOut, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { notifyAuthRevoked } from "@/src/lib/trail-extension";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/trails", label: "Trails", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
];

type UserInfo = {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
};

function getInitials(name: string | null, email: string | null): string {
  const source = name || email || "?";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((c) => c[0]?.toUpperCase())
    .join("");
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return link;
      })}
    </nav>
  );
}

function SidebarFooter({
  user,
  collapsed,
}: {
  user: UserInfo;
  collapsed: boolean;
}) {
  const [pending, setPending] = React.useState(false);

  const handleSignOut = async () => {
    if (pending) return;
    setPending(true);
    notifyAuthRevoked().catch(() => {});
    try {
      const res = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Logout failed");
      window.location.assign("/");
    } catch {
      setPending(false);
    }
  };

  const avatar = (
    <Avatar className="h-8 w-8">
      {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name ?? ""} />}
      <AvatarFallback className="text-xs">
        {getInitials(user.name, user.email)}
      </AvatarFallback>
    </Avatar>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={pending}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
        {avatar}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <Separator />
      <div className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email ?? ""}</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={pending}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function AppSidebar({ user }: { user: UserInfo }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-3 z-40 md:hidden"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <VisuallyHidden.Root>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden.Root>
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center gap-2 px-4">
              <Image
                src="/brand/trail-fork-dark.svg"
                alt="Trail"
                width={20}
                height={20}
                className="block dark:hidden"
              />
              <Image
                src="/brand/trail-fork-light.svg"
                alt="Trail"
                width={20}
                height={20}
                className="hidden dark:block"
              />
              <span className="text-sm font-semibold">trail</span>
            </div>
            <Separator />
            <div className="flex-1 py-4">
              <SidebarNav collapsed={false} />
            </div>
            <SidebarFooter user={user} collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:border-r md:border-border md:bg-background transition-[width] duration-200",
          collapsed ? "md:w-[60px]" : "md:w-[220px]",
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-2")}>
          <Image
            src="/brand/trail-fork-dark.svg"
            alt="Trail"
            width={20}
            height={20}
            className="block dark:hidden"
          />
          <Image
            src="/brand/trail-fork-light.svg"
            alt="Trail"
            width={20}
            height={20}
            className="hidden dark:block"
          />
          {!collapsed && <span className="text-sm font-semibold">trail</span>}
        </div>
        <Separator />

        <div className="flex-1 py-4">
          <SidebarNav collapsed={collapsed} />
        </div>

        <div className="px-2 pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-accent-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                <ChevronLeft
                  className={cn(
                    "h-4 w-4 transition-transform",
                    collapsed && "rotate-180",
                  )}
                />
                {!collapsed && <span>Collapse</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Expand</TooltipContent>}
          </Tooltip>
        </div>

        <SidebarFooter user={user} collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
}
