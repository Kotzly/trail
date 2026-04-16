import { useState } from "react";
import { useSettings } from "./hooks/useSettings.js";
import { AccountPage } from "./pages/AccountPage.js";
import { DataPage } from "./pages/DataPage.js";
import { AppearancePage } from "./pages/AppearancePage.js";
import { BehaviorPage } from "./pages/BehaviorPage.js";
import { ShortcutsPage } from "./pages/ShortcutsPage.js";
import { PrivacyPage } from "./pages/PrivacyPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import { cn } from "@ui/lib/utils";

type Page = "account" | "data" | "appearance" | "behavior" | "shortcuts" | "privacy" | "about";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "data", label: "Data" },
  { id: "appearance", label: "Appearance" },
  { id: "behavior", label: "Behavior" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "privacy", label: "Privacy" },
  { id: "about", label: "About" },
];

export default function SettingsApp() {
  const [page, setPage] = useState<Page>("account");
  const { settings, loading, updateSettings } = useSettings();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background text-foreground flex h-screen">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r p-4">
          <h1 className="mb-4 text-lg font-semibold">Trail Settings</h1>
          <Separator className="mb-2" />
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={cn("w-full justify-start", page === item.id && "bg-accent")}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
        <main className="max-w-2xl flex-1 overflow-y-auto p-6">
          {loading || !settings ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <>
              {page === "account" && <AccountPage />}
              {page === "data" && <DataPage />}
              {page === "appearance" && (
                <AppearancePage settings={settings} onUpdate={updateSettings} />
              )}
              {page === "behavior" && (
                <BehaviorPage settings={settings} onUpdate={updateSettings} />
              )}
              {page === "shortcuts" && <ShortcutsPage />}
              {page === "privacy" && <PrivacyPage />}
              {page === "about" && <AboutPage />}
            </>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
