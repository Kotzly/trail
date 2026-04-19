import { useEffect, useState } from "react";
import { useSettings } from "./hooks/useSettings.js";
import { AccountPage } from "./pages/AccountPage.js";
import { TreesPage } from "./pages/TreesPage.js";
import { AppearancePage } from "./pages/AppearancePage.js";
import { BehaviorPage } from "./pages/BehaviorPage.js";
import { ShortcutsPage } from "./pages/ShortcutsPage.js";
import { PrivacyPage } from "./pages/PrivacyPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { Separator } from "@ui/components/ui/separator";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/ui/tabs";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import { Toaster } from "@ui/components/ui/sonner";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";
import { showUiToast } from "@apps/sidepanel/ui/notifications/sonner-adapter.js";

type Page = "account" | "trees" | "appearance" | "behavior" | "shortcuts" | "privacy" | "about";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "trees", label: "Trees" },
  { id: "appearance", label: "Appearance" },
  { id: "behavior", label: "Behavior" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "privacy", label: "Privacy" },
  { id: "about", label: "About" },
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
  const [page, setPage] = useState<Page>(() => pageFromHash() ?? "account");
  const { settings, loading, updateSettings } = useSettings();

  // Honor hash-based deep-links (e.g. settings.html#behavior) both on
  // mount and when the hash changes — lets the onboarding "Open
  // Behavior settings" link jump straight to the right tab.
  useEffect(() => {
    const onHashChange = () => {
      const next = pageFromHash();
      if (next) setPage(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Surface background-emitted UI_NOTIFY events (sync failures,
  // conflicts, backfill progress) as toasts in the settings window.
  useEffect(() => {
    return onExtensionMessage(EXTENSION_MESSAGE.UI_NOTIFY, ({ data }) => {
      showUiToast(data);
    });
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster />
      <Tabs
        orientation="vertical"
        value={page}
        onValueChange={(v) => setPage(v as Page)}
        className="bg-background text-foreground flex h-screen gap-0"
      >
        <aside className="flex w-48 shrink-0 flex-col gap-1 border-r p-4">
          <h1 className="mb-4 text-lg font-semibold">Trail Settings</h1>
          <Separator className="mb-2" />
          <TabsList
            variant="line"
            className="h-fit w-full flex-col items-stretch gap-1 bg-transparent p-0"
          >
            {NAV_ITEMS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl p-6 md:p-8">
            {loading || !settings ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                <TabsContent value="account">
                  <AccountPage />
                </TabsContent>
                <TabsContent value="trees">
                  <TreesPage />
                </TabsContent>
                <TabsContent value="appearance">
                  <AppearancePage settings={settings} onUpdate={updateSettings} />
                </TabsContent>
                <TabsContent value="behavior">
                  <BehaviorPage settings={settings} onUpdate={updateSettings} />
                </TabsContent>
                <TabsContent value="shortcuts">
                  <ShortcutsPage />
                </TabsContent>
                <TabsContent value="privacy">
                  <PrivacyPage />
                </TabsContent>
                <TabsContent value="about">
                  <AboutPage />
                </TabsContent>
              </>
            )}
          </div>
        </main>
      </Tabs>
    </TooltipProvider>
  );
}
