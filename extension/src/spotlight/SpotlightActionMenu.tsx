import { useEffect, useState } from "react";
import type {
  SpotlightActionResult,
  SpotlightActionSafety,
  SpotlightActionId,
  SpotlightActionTarget,
  SpotlightSearchResult,
} from "./types.js";

type SpotlightActionMenuProps = {
  actions: SpotlightActionResult[];
  onSelect: (action: SpotlightActionResult) => void;
  onClose: () => void;
};

export function SpotlightActionMenu({ actions, onSelect, onClose }: SpotlightActionMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [actions]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((i) => Math.min(i + 1, actions.length - 1));
          return;
        case "ArrowUp":
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        case "Enter": {
          event.preventDefault();
          event.stopPropagation();
          const action = actions[selectedIndex];
          if (action) onSelect(action);
          return;
        }
        case "Escape":
        case "k": {
          if (event.key === "k" && !event.metaKey && !event.ctrlKey) return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [actions, selectedIndex, onSelect, onClose]);

  return (
    <div className="spotlight-action-menu" role="menu">
      {actions.map((action, i) => (
        <button
          key={action.key}
          type="button"
          className="spotlight-action-menu-item"
          data-selected={i === selectedIndex}
          data-destructive={action.safety === "destructive"}
          role="menuitem"
          onClick={() => onSelect(action)}
        >
          <span className="spotlight-action-menu-title">{action.title}</span>
          <span className="spotlight-action-menu-hint">{action.shortcutHint}</span>
        </button>
      ))}
    </div>
  );
}

type ActionSeed = {
  actionId: SpotlightActionId;
  title: string;
  subtitle: string;
  safety: SpotlightActionSafety;
  shortcutHint: "Enter";
  target?: SpotlightActionTarget;
};

function toActionResult(seed: ActionSeed): SpotlightActionResult {
  const targetSuffix = seed.target
    ? `${seed.target.kind}:${"treeId" in seed.target ? seed.target.treeId : "nodeId" in seed.target ? String(seed.target.nodeId) : ""}`
    : "global";
  return {
    kind: "action",
    key: `am:${seed.actionId}:${targetSuffix}`,
    actionId: seed.actionId,
    title: seed.title,
    subtitle: seed.subtitle,
    safety: seed.safety,
    shortcutHint: seed.shortcutHint,
    ...(seed.target ? { target: seed.target } : {}),
  };
}

export function buildClientContextActions(
  item: SpotlightSearchResult,
  activeTreeId: string | null,
): SpotlightActionResult[] {
  if (item.kind === "action") return [];

  if (item.kind === "tree") {
    return [
      toActionResult({
        actionId: "open-tree",
        title: "Open tree",
        subtitle: item.treeName,
        safety: "safe",
        shortcutHint: "Enter",
        target: { kind: "tree", treeId: item.treeId },
      }),
      toActionResult({
        actionId: "export-tree",
        title: "Export tree",
        subtitle: item.treeName,
        safety: "safe",
        shortcutHint: "Enter",
        target: { kind: "tree", treeId: item.treeId },
      }),
      toActionResult({
        actionId: "delete-archived-tree",
        title: "Delete archived tree",
        subtitle: item.treeName,
        safety: "destructive",
        shortcutHint: "Enter",
        target: { kind: "tree", treeId: item.treeId },
      }),
    ];
  }

  const isForeign = activeTreeId !== null && item.treeId !== activeTreeId;
  const actions: ActionSeed[] = [
    {
      actionId: isForeign ? "open-node-in-tree" : "open",
      title: isForeign ? "Open in tree" : "Open",
      subtitle: item.title,
      safety: "safe",
      shortcutHint: "Enter",
      target: { kind: "node", nodeId: item.nodeId, treeId: item.treeId },
    },
    {
      actionId: "open-url-only",
      title: "Open URL only",
      subtitle: item.url,
      safety: "safe",
      shortcutHint: "Enter",
      target: { kind: "url", url: item.url },
    },
    {
      actionId: "copy-url",
      title: "Copy URL",
      subtitle: item.url,
      safety: "safe",
      shortcutHint: "Enter",
      target: { kind: "node", nodeId: item.nodeId, treeId: item.treeId },
    },
  ];

  if (!isForeign) {
    actions.push({
      actionId: item.pinned ? "unpin" : "pin",
      title: item.pinned ? "Unpin page" : "Pin page",
      subtitle: item.title,
      safety: "safe",
      shortcutHint: "Enter",
      target: { kind: "node", nodeId: item.nodeId, treeId: item.treeId },
    });
    if (item.tabCount > 0) {
      actions.push({
        actionId: item.tabCount > 1 ? "close-tabs" : "close-tab",
        title: item.tabCount > 1 ? "Close tabs for page" : "Close tab",
        subtitle: item.title,
        safety: "destructive",
        shortcutHint: "Enter",
        target: { kind: "node", nodeId: item.nodeId, treeId: item.treeId },
      });
    }
  }

  return actions.slice(0, 5).map(toActionResult);
}
