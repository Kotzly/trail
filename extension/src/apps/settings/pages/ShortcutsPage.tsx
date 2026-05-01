import { i18n } from "#i18n";
import { Shortcut, type ShortcutKey } from "@ui/components/shortcut";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";

type ShortcutRow = {
  keys: readonly ShortcutKey[];
  label: string;
};

type ShortcutGroup = {
  eyebrow: string;
  items: readonly ShortcutRow[];
};

function buildGroups(): readonly ShortcutGroup[] {
  return [
    {
      eyebrow: i18n.t("settings.shortcuts.groupNavigation"),
      items: [
        { keys: ["meta", "K"], label: i18n.t("settings.shortcuts.openPaletteSearch") },
        { keys: ["meta", "F"], label: i18n.t("settings.shortcuts.openPalette") },
        { keys: ["/"], label: i18n.t("settings.shortcuts.openPalette") },
        { keys: ["up"], label: i18n.t("settings.shortcuts.moveUp") },
        { keys: ["down"], label: i18n.t("settings.shortcuts.moveDown") },
        { keys: ["left"], label: i18n.t("settings.shortcuts.moveLeft") },
        { keys: ["right"], label: i18n.t("settings.shortcuts.moveRight") },
        { keys: ["enter"], label: i18n.t("settings.shortcuts.navigate") },
        { keys: ["meta", "enter"], label: i18n.t("settings.shortcuts.openInNewTab") },
        { keys: ["escape"], label: i18n.t("settings.shortcuts.closePopups") },
      ],
    },
    {
      eyebrow: i18n.t("settings.shortcuts.groupEditing"),
      items: [
        { keys: ["F2"], label: i18n.t("settings.shortcuts.renameNode") },
        { keys: ["delete"], label: i18n.t("settings.shortcuts.deleteNode") },
        { keys: ["backspace"], label: i18n.t("settings.shortcuts.deleteNode") },
        { keys: ["shift", "delete"], label: i18n.t("settings.shortcuts.deleteSubtree") },
        { keys: ["shift", "backspace"], label: i18n.t("settings.shortcuts.deleteSubtree") },
        { keys: ["P"], label: i18n.t("settings.shortcuts.togglePin") },
        { keys: ["meta", "Z"], label: i18n.t("settings.shortcuts.undo") },
        { keys: ["meta", "shift", "Z"], label: i18n.t("settings.shortcuts.redo") },
        { keys: ["meta", "A"], label: i18n.t("settings.shortcuts.selectAll") },
        { keys: ["meta", "shift", "A"], label: i18n.t("settings.shortcuts.clearSelection") },
      ],
    },
    {
      eyebrow: i18n.t("settings.shortcuts.groupViews"),
      items: [
        { keys: ["shift", "P"], label: i18n.t("settings.shortcuts.togglePinned") },
        { keys: ["shift", "T"], label: i18n.t("settings.shortcuts.toggleTreeSwitcher") },
        { keys: ["shift", "F"], label: i18n.t("settings.shortcuts.toggleTagFilter") },
        { keys: ["shift", "L"], label: i18n.t("settings.shortcuts.cycleLayout") },
        { keys: ["shift", "C"], label: i18n.t("settings.shortcuts.toggleConnections") },
        { keys: ["meta", ","], label: i18n.t("settings.shortcuts.openSettings") },
        { keys: ["meta", "/"], label: i18n.t("settings.shortcuts.showOverlay") },
      ],
    },
  ];
}

export function ShortcutsPage() {
  const groups = buildGroups();
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={i18n.t("settings.shortcuts.title")}
        description={i18n.t("settings.shortcuts.description")}
      />

      {groups.map((group) => (
        <section key={group.eyebrow} className="flex flex-col gap-3">
          <SectionHeader eyebrow={group.eyebrow} />
          <ul className="divide-border divide-y">
            {group.items.map((item, idx) => (
              <li
                key={`${item.label}-${idx}`}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="text-foreground">{item.label}</span>
                <Shortcut keys={item.keys} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
