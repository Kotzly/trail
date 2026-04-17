import { Shortcut, type ShortcutKey } from "@ui/components/shortcut";

type Entry = {
  keys: readonly ShortcutKey[];
  label: string;
};

const SHORTCUTS: readonly Entry[] = [
  { keys: ["meta", "K"], label: "Command palette" },
  { keys: ["meta", "Z"], label: "Undo (last 30)" },
  { keys: ["F2"], label: "Rename node" },
  { keys: ["meta", "/"], label: "All shortcuts" },
];

export function ReadyStep() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-300">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-400">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">You&apos;re set.</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A few shortcuts to make it feel yours.
        </p>
      </div>

      <ul className="bg-card/60 divide-border/60 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both divide-y overflow-hidden rounded-lg border delay-75 duration-400">
        {SHORTCUTS.map((entry) => (
          <li key={entry.label} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-foreground text-xs">{entry.label}</span>
            <Shortcut keys={entry.keys} />
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground animate-in fade-in-0 fill-mode-both text-center text-[11px] delay-150 duration-400">
        Happy trailing.
      </p>
    </div>
  );
}
