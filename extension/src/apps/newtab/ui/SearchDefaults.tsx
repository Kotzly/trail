import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Globe02Icon, Bookmark01Icon, NeuralNetworkIcon, FolderOpenIcon } from "@hugeicons/core-free-icons";
import { executeSpotlightAction } from "@features/spotlight/ui/rpc.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchDefaultsProps = {
  readonly query: string;
  readonly onSetQuery: (q: string) => void;
};

type DefaultAction = {
  readonly id: string;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly sublabel?: string;
  readonly onSelect: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchDefaults({ query, onSetQuery }: SearchDefaultsProps) {
  const trimmed = query.trim();

  const actions: DefaultAction[] = [
    {
      id: "web",
      icon: <HugeiconsIcon icon={Globe02Icon} size={15} strokeWidth={1.8} />,
      label: trimmed ? `Search "${trimmed}" on the web` : "Search on the web",
      onSelect: () => {
        void executeSpotlightAction("search-default-engine", { kind: "search", query: trimmed });
      },
    },
    {
      id: "bookmarks",
      icon: <HugeiconsIcon icon={Bookmark01Icon} size={15} strokeWidth={1.8} />,
      label: trimmed ? `Find "${trimmed}" in bookmarks` : "Browse bookmarks",
      onSelect: () => onSetQuery(trimmed ? `bookmarks:${trimmed}` : "bookmarks:"),
    },
    {
      id: "trails",
      icon: <HugeiconsIcon icon={NeuralNetworkIcon} size={15} strokeWidth={1.8} />,
      label: trimmed ? `Find "${trimmed}" in trails` : "Browse trails",
      onSelect: () => onSetQuery(trimmed ? `trees:${trimmed}` : "trees:"),
    },
    {
      id: "tabs",
      icon: <HugeiconsIcon icon={FolderOpenIcon} size={15} strokeWidth={1.8} />,
      label: trimmed ? `Find "${trimmed}" in open tabs` : "Show open tabs",
      onSelect: () => onSetQuery(trimmed ? `tabs:${trimmed}` : "tabs:"),
    },
    {
      id: "commands",
      icon: <HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.8} />,
      label: "Run a command",
      sublabel: "Type > to see available commands",
      onSelect: () => onSetQuery(">"),
    },
  ];

  return (
    <div className="newtab-search-defaults">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="newtab-search-default-item"
          onClick={action.onSelect}
        >
          <span className="newtab-search-default-icon">{action.icon}</span>
          <span className="newtab-search-default-text">
            <span className="newtab-search-default-label">{action.label}</span>
            {action.sublabel && (
              <span className="newtab-search-default-sublabel">{action.sublabel}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
