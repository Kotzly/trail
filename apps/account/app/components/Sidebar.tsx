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
  Settings,
  SparklesIcon,
} from "lucide-react";
import { ProgressIndicator } from "./onboarding/ProgressIndicator";

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

// Example onboarding progress - this would come from your backend
const onboardingProgressSteps = [
  { id: "1", label: "install", status: "completed" as const },
  { id: "2", label: "connect", status: "current" as const },
  { id: "3", label: "capture", status: "pending" as const },
  { id: "4", label: "share", status: "pending" as const },
];

function OnboardingMiniProgress() {
  const completedCount = onboardingProgressSteps.filter(s => s.status === "completed").length;
  const progress = (completedCount / onboardingProgressSteps.length) * 100;

  if (completedCount === onboardingProgressSteps.length) {
    return null; // Don't show if all completed
  }

  return (
    <Link
      href="/dashboard"
      className="group mx-2 rounded-xl border border-border/60 bg-surface/70 p-3 transition-all hover:border-accent/50 hover:bg-surface-high"
      aria-label="Continue your onboarding"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-ink">setup progress</span>
        </div>
        <span className="text-[0.65rem] text-ink-subtle">
          {completedCount}/{onboardingProgressSteps.length}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-high">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-[0.65rem] text-ink-subtle">
        click to continue
      </p>
    </Link>
  );
}

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

          {/* Mini Onboarding Progress */}
          <div className="mt-6">
            <OnboardingMiniProgress />
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
