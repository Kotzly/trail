import { useState } from "react";
import { useSettings } from "./hooks/useSettings.js";
import { TreesPage } from "./pages/TreesPage.js";
import { AppearancePage } from "./pages/AppearancePage.js";
import { BehaviorPage } from "./pages/BehaviorPage.js";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";
import { cn } from "@ui/lib/utils";

type Page = "trees" | "appearance" | "behavior";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "trees", label: "Trees" },
  { id: "appearance", label: "Appearance" },
  { id: "behavior", label: "Behavior" },
];

export default function SettingsApp() {
  const [page, setPage] = useState<Page>("trees");
  const { settings, loading, updateSettings } = useSettings();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <nav className="w-48 border-r p-4 flex flex-col gap-1 shrink-0">
        <h1 className="text-lg font-semibold mb-4">Trail Settings</h1>
        <Separator className="mb-2" />
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "justify-start w-full",
              page === item.id && "bg-accent",
            )}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <main className="flex-1 p-6 overflow-y-auto max-w-2xl">
        {loading || !settings ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            {page === "trees" && <TreesPage />}
            {page === "appearance" && (
              <AppearancePage settings={settings} onUpdate={updateSettings} />
            )}
            {page === "behavior" && (
              <BehaviorPage settings={settings} onUpdate={updateSettings} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
