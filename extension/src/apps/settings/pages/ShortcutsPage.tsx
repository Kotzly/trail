import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Shortcut, type ShortcutKey } from "@ui/components/shortcut";

type ShortcutRow = {
  keys: readonly ShortcutKey[];
  label: string;
};

type ShortcutGroup = {
  title: string;
  items: readonly ShortcutRow[];
};

const GROUPS: readonly ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["meta", "K"], label: "Open command palette (search everything)" },
      { keys: ["meta", "F"], label: "Open command palette" },
      { keys: ["/"], label: "Open command palette" },
      { keys: ["up"], label: "Move focus up" },
      { keys: ["down"], label: "Move focus down" },
      { keys: ["left"], label: "Move focus left" },
      { keys: ["right"], label: "Move focus right" },
      { keys: ["enter"], label: "Navigate to selected node" },
      { keys: ["meta", "enter"], label: "Open selected node in new tab" },
      { keys: ["escape"], label: "Close popups / clear selection" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: ["F2"], label: "Rename selected node" },
      { keys: ["delete"], label: "Delete node" },
      { keys: ["shift", "delete"], label: "Delete node and all children" },
      { keys: ["P"], label: "Toggle pin on selection" },
      { keys: ["meta", "Z"], label: "Undo" },
      { keys: ["meta", "shift", "Z"], label: "Redo" },
      { keys: ["meta", "A"], label: "Select all visible" },
      { keys: ["meta", "shift", "A"], label: "Clear selection" },
    ],
  },
  {
    title: "Views & panels",
    items: [
      { keys: ["shift", "P"], label: "Toggle pinned dropdown" },
      { keys: ["shift", "T"], label: "Toggle tree switcher" },
      { keys: ["shift", "F"], label: "Toggle tag filter" },
      { keys: ["shift", "L"], label: "Cycle layout (tree ↔ mindmap)" },
      { keys: ["shift", "C"], label: "Toggle connection lines" },
      { keys: ["meta", ","], label: "Open settings" },
      { keys: ["meta", "/"], label: "Show shortcut tooltips overlay" },
    ],
  },
];

export function ShortcutsPage() {
  return (
    <div className="flex flex-col gap-4">
      <CardHeader className="px-0">
        <CardTitle>Keyboard shortcuts</CardTitle>
        <p className="text-muted-foreground text-sm">All shortcuts at a glance.</p>
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
                <Shortcut keys={item.keys} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
