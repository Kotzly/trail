import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSettings } from "./hooks/useSettings.js";
import { useThemeSync } from "@apps/sidepanel/ui/hooks/useThemeSync.js";
import { useThemePresetSync } from "@apps/sidepanel/ui/hooks/useThemePresetSync.js";
import { AccountPage } from "./pages/AccountPage.js";
import { TreesPage } from "./pages/TreesPage.js";
import { AppearancePage } from "./pages/AppearancePage.js";
import { BehaviorPage } from "./pages/BehaviorPage.js";
import { ShortcutsPage } from "./pages/ShortcutsPage.js";
import { PrivacyPage } from "./pages/PrivacyPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { Skeleton } from "@ui/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@ui/components/ui/sidebar";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import { Toaster } from "@ui/components/ui/sonner";
import { Icons, type IconProps } from "@ui/components/icons";
import { Avatar, AvatarFallback } from "@ui/components/ui/avatar";
import TrailLogo from "@ui/components/trail-logo";
import { AccountFooterChip } from "./components/AccountFooterChip.js";
import { SidebarResizeHandle } from "./components/SidebarResizeHandle.js";
import { useRestoreSidebarWidth } from "./components/use-restore-sidebar-width.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";
import { showUiToast } from "@apps/sidepanel/ui/notifications/sonner-adapter.js";

type Page = "account" | "trees" | "appearance" | "behavior" | "shortcuts" | "privacy" | "about";

type NavItem = {
  id: Exclude<Page, "account">;
  label: string;
  Icon: ComponentType<IconProps>;
};

const NAV_ITEMS: NavItem[] = [
  { id: "trees", label: "Trees", Icon: Icons.ListTree },
  { id: "appearance", label: "Appearance", Icon: Icons.Palette },
  { id: "behavior", label: "Behavior", Icon: Icons.SlidersHorizontal },
  { id: "shortcuts", label: "Shortcuts", Icon: Icons.Keyboard },
  { id: "privacy", label: "Privacy", Icon: Icons.Shield },
  { id: "about", label: "About", Icon: Icons.Info },
];

const VALID_PAGES = new Set<Page>([
  "account",
  "trees",
  "appearance",
  "behavior",
  "shortcuts",
  "privacy",
  "about",
]);

function pageFromHash(): Page | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  return VALID_PAGES.has(hash as Page) ? (hash as Page) : null;
}

export default function SettingsApp() {
  const [page, setPage] = useState<Page>(() => pageFromHash() ?? "trees");
  const { settings, loading, updateSettings } = useSettings();
  useThemeSync(settings?.theme);
  useThemePresetSync(settings?.themePreset);
  useRestoreSidebarWidth();

  useEffect(() => {
    const onHashChange = () => {
      const next = pageFromHash();
      if (next) setPage(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    return onExtensionMessage(EXTENSION_MESSAGE.UI_NOTIFY, ({ data }) => {
      showUiToast(data);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pageFromHash() === page) return;
    window.location.hash = page;
  }, [page]);

  const handleSelect = (id: Page) => {
    setPage(id);
  };

  const reduce = useReducedMotion();
  const pageTransition = reduce
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.23, 1, 0.32, 1] as const };
  const pageVariants = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, x: 8 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -4 },
      };

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <Toaster />
      <SidebarProvider
        data-testid="settings-app"
        style={
          {
            "--sidebar-width": "14rem",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
        className="bg-background text-foreground h-screen min-h-0"
      >
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Trail Settings"
                  className="cursor-default hover:bg-transparent active:bg-transparent data-active:bg-transparent"
                  asChild
                >
                  <div>
                    <Avatar>
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                        <TrailLogo variant="empty" className="!size-4" aria-hidden />
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium tracking-tight">
                        Trail Settings
                      </span>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={page === item.id}
                          tooltip={item.label}
                          onClick={() => handleSelect(item.id)}
                          data-testid={`settings-nav-${item.id}`}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <AccountFooterChip onOpenAccount={() => handleSelect("account")} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          <SidebarResizeHandle />
        </Sidebar>

        <SidebarInset className="min-w-0">
          <header className="bg-background sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="animate-in fade-in-0 mx-auto w-full max-w-2xl p-6 duration-(--dur-base) ease-(--ease-out) md:p-8">
              {loading || !settings ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={page}
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    {page === "account" && <AccountPage />}
                    {page === "trees" && <TreesPage />}
                    {page === "appearance" && (
                      <AppearancePage settings={settings} onUpdate={updateSettings} />
                    )}
                    {page === "behavior" && (
                      <BehaviorPage settings={settings} onUpdate={updateSettings} />
                    )}
                    {page === "shortcuts" && <ShortcutsPage />}
                    {page === "privacy" && <PrivacyPage />}
                    {page === "about" && <AboutPage />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
