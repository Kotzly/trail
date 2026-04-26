import { i18n } from "#i18n";
import { Shortcut, type ShortcutKey } from "@ui/components/shortcut";
import { Card } from "@ui/components/ui/card";

type Entry = {
  keys: readonly ShortcutKey[];
  labelKey:
    | "onboarding.ready.shortcut.commandPalette"
    | "onboarding.ready.shortcut.undo"
    | "onboarding.ready.shortcut.renameNode"
    | "onboarding.ready.shortcut.allShortcuts";
};

const SHORTCUTS: readonly Entry[] = [
  { keys: ["meta", "K"], labelKey: "onboarding.ready.shortcut.commandPalette" },
  { keys: ["meta", "Z"], labelKey: "onboarding.ready.shortcut.undo" },
  { keys: ["F2"], labelKey: "onboarding.ready.shortcut.renameNode" },
  { keys: ["meta", "/"], labelKey: "onboarding.ready.shortcut.allShortcuts" },
];

export function ReadyStep() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-300">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-300">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.ready.title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {i18n.t("onboarding.ready.body")}
        </p>
      </div>

      <Card className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both gap-0 py-0 duration-300">
        <ul className="divide-border/60 divide-y">
          {SHORTCUTS.map((entry) => (
            <li key={entry.labelKey} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-foreground text-xs">{i18n.t(entry.labelKey)}</span>
              <Shortcut keys={entry.keys} />
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both text-center text-[11px] duration-300">
        {i18n.t("onboarding.ready.footer")}
      </p>
    </div>
  );
}
