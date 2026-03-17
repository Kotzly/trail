import { Search, Globe, Bookmark, Network, FolderOpen } from 'lucide-react';
import { executeSpotlightAction } from '../../../spotlight/rpc.js';

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
      id: 'web',
      icon: <Globe size={15} strokeWidth={1.8} />,
      label: trimmed ? `Search "${trimmed}" on the web` : 'Search on the web',
      onSelect: () => {
        void executeSpotlightAction('search-default-engine', { kind: 'search', query: trimmed });
      },
    },
    {
      id: 'bookmarks',
      icon: <Bookmark size={15} strokeWidth={1.8} />,
      label: trimmed ? `Find "${trimmed}" in bookmarks` : 'Browse bookmarks',
      onSelect: () => onSetQuery(trimmed ? `bookmarks:${trimmed}` : 'bookmarks:'),
    },
    {
      id: 'trails',
      icon: <Network size={15} strokeWidth={1.8} />,
      label: trimmed ? `Find "${trimmed}" in trails` : 'Browse trails',
      onSelect: () => onSetQuery(trimmed ? `trees:${trimmed}` : 'trees:'),
    },
    {
      id: 'tabs',
      icon: <FolderOpen size={15} strokeWidth={1.8} />,
      label: trimmed ? `Find "${trimmed}" in open tabs` : 'Show open tabs',
      onSelect: () => onSetQuery(trimmed ? `tabs:${trimmed}` : 'tabs:'),
    },
    {
      id: 'commands',
      icon: <Search size={15} strokeWidth={1.8} />,
      label: 'Run a command',
      sublabel: 'Type > to see available commands',
      onSelect: () => onSetQuery('>'),
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
