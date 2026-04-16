import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Kbd, KbdGroup } from "@ui/components/ui/kbd";

type Shortcut = {
  keys: string[];
  label: string;
};

type ShortcutGroup = {
  title: string;
  items: Shortcut[];
};

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["⌘K"], label: "Open command palette (search everything)" },
      { keys: ["⌘F"], label: "Open command palette" },
      { keys: ["/"], label: "Open command palette" },
      { keys: ["↑", "↓", "←", "→"], label: "Move focus between nodes" },
      { keys: ["Enter"], label: "Navigate to selected node" },
      { keys: ["⌘Enter"], label: "Open selected node in new tab" },
      { keys: ["Esc"], label: "Close popups / clear selection" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: ["F2"], label: "Rename selected node" },
      { keys: ["Delete"], label: "Delete node" },
      { keys: ["⇧ Delete"], label: "Delete node and all children" },
      { keys: ["P"], label: "Toggle pin on selection" },
      { keys: ["⌘Z"], label: "Undo" },
      { keys: ["⌘⇧Z"], label: "Redo" },
      { keys: ["⌘A"], label: "Select all visible" },
      { keys: ["⌘⇧A"], label: "Clear selection" },
    ],
  },
  {
    title: "Views & panels",
    items: [
      { keys: ["⇧P"], label: "Toggle pinned dropdown" },
      { keys: ["⇧T"], label: "Toggle tree switcher" },
      { keys: ["⇧F"], label: "Toggle tag filter" },
      { keys: ["⇧L"], label: "Cycle layout (tree ↔ mindmap)" },
      { keys: ["⇧C"], label: "Toggle connection lines" },
      { keys: ["⌘,"], label: "Open settings" },
      { keys: ["⌘/"], label: "Show shortcut tooltips overlay" },
    ],
  },
];

export function ShortcutsPage() {
  return (
    <div className="flex flex-col gap-4">
      <CardHeader className="px-0">
        <CardTitle>Keyboard shortcuts</CardTitle>
        <p className="text-muted-foreground text-sm">
          All shortcuts at a glance. On Windows/Linux, swap ⌘ for Ctrl.
        </p>
      </CardHeader>

      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {group.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                <span>{item.label}</span>
                <KbdGroup className="shrink-0">
                  {item.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
