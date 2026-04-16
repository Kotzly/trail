import { useState } from "react";
import { useSettings } from "./hooks/useSettings.js";
import { TreesPage } from "./pages/TreesPage.js";
import { AppearancePage } from "./pages/AppearancePage.js";
import { BehaviorPage } from "./pages/BehaviorPage.js";
import { PrivacyPage } from "./pages/PrivacyPage.js";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";
import { cn } from "@ui/lib/utils";

type Page = "trees" | "appearance" | "behavior" | "privacy";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "trees", label: "Trees" },
  { id: "appearance", label: "Appearance" },
  { id: "behavior", label: "Behavior" },
  { id: "privacy", label: "Privacy" },
];

export default function SettingsApp() {
  const [page, setPage] = useState<Page>("trees");
  const { settings, loading, updateSettings } = useSettings();

  return (
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
            {page === "trees" && <TreesPage />}
            {page === "appearance" && (
              <AppearancePage settings={settings} onUpdate={updateSettings} />
            )}
            {page === "behavior" && <BehaviorPage settings={settings} onUpdate={updateSettings} />}
            {page === "privacy" && <PrivacyPage />}
          </>
        )}
      </main>
    </div>
  );
}
