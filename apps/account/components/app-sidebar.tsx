"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  GitBranch,
  Activity,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";
import { notifyAuthRevoked } from "@/src/lib/trail-extension";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type User = {
  id: string;
  email: string;
  name: string;
  imageUrl?: string;
};

type NavKey = "trails" | "activity" | "settings" | "billing";

type NavItem = {
  key: NavKey;
  href: string;
  icon: typeof GitBranch;
};

const navItems: NavItem[] = [
  { key: "trails", href: "/trails", icon: GitBranch },
  { key: "activity", href: "/activity", icon: Activity },
];

const settingsItems: NavItem[] = [
  { key: "settings", href: "/settings", icon: Settings },
  { key: "billing", href: "/billing", icon: CreditCard },
];

export function AppSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/trails" className="flex items-center gap-2">
          <Image
            src="/brand/trail-mark.svg"
            alt=""
            width={20}
            height={20}
            className="dark:invert"
          />
          <span className="text-lg font-semibold tracking-tight">Trail</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        <SidebarGroup>
          <SidebarGroupLabel>{t("account")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.imageUrl} alt={user.name} />
            <AvatarFallback>
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <form
            action="/auth/logout"
            method="POST"
            onSubmit={(e) => {
              e.preventDefault();
              notifyAuthRevoked().catch(() => {});
              (e.target as HTMLFormElement).submit();
            }}
          >
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={t("signOut")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
