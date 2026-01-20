import { useMemo, useState } from 'react';
import type { FaviconUrl, NodeId, Timestamp, Url } from '../../../shared/types/ids.js';
import type { NavigationTree } from '../../../background/state/nav-tree.js';
import { formatTime, formatUrl } from '../shared/format.js';
import { Icons } from './Icon.js';
import React from 'react';

type SearchResultsListProps = {
  tree: NavigationTree | null;
  results: NodeId[];
  activeId: NodeId | null;
  query: string;
  onSelect: (id: NodeId) => void;
};

type SearchResultItem = {
  id: NodeId;
  title: string;
  url: Url;
  favicon?: FaviconUrl;
  timestamp: Timestamp;
};

export default function SearchResultsList({
  tree,
  results,
  activeId,
  query,
  onSelect,
}: SearchResultsListProps) {
  const items = useMemo<SearchResultItem[]>(() => {
    if (!tree) return [];
    const next: SearchResultItem[] = [];
    for (const id of results) {
      const node = tree.findNodeById(id);
      if (!node) continue;
      const favicon = node.data.favicon;
      next.push({
        id,
        title: node.data.title || 'Untitled',
        url: node.data.url,
        timestamp: node.timestamp,
        ...(favicon !== undefined ? { favicon } : {}),
      });
    }
    return next;
  }, [results, tree]);

  if (items.length === 0) {
    return <div className="floating-search-list-empty">No results</div>;
  }

  return (
    <div className="floating-search-list">
      {items.map((item) => (
        <SearchResultRow
          key={item.id}
          item={item}
          query={query}
          isActive={activeId === item.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

type SearchResultRowProps = {
  item: SearchResultItem;
  query: string;
  isActive: boolean;
  onSelect: (id: NodeId) => void;
};

const SearchResultRow = React.memo(function SearchResultRow({
  item,
  query,
  isActive,
  onSelect,
}: SearchResultRowProps) {
  const [faviconError, setFaviconError] = useState(false);
  const title = renderHighlight(item.title, query);
  const url = renderHighlight(formatUrl(item.url), query);

  return (
    <button
      className={`floating-search-item${isActive ? ' is-active' : ''}`}
      type="button"
      onClick={() => onSelect(item.id)}
    >
      <div className="floating-search-item-icon" aria-hidden="true">
        {item.favicon && !faviconError ? (
          <img src={item.favicon} alt="" onError={() => setFaviconError(true)} />
        ) : (
          <Icons.Search size={14} />
        )}
      </div>
      <div className="floating-search-item-main">
        <div className="floating-search-item-title">{title}</div>
        <div className="floating-search-item-url">{url}</div>
      </div>
      <div className="floating-search-item-time">{formatTime(item.timestamp)}</div>
    </button>
  );
});

function renderHighlight(text: string, query: string): React.ReactNode {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  const escaped = tokens.map(escapeRegExp);
  const pattern = new RegExp(`(${escaped.join('|')})`, 'ig');
  const parts = text.split(pattern);
  return parts.map((part, index) => {
    const match = tokens.some((token) => token.toLowerCase() === part.toLowerCase());
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    return (
      <mark key={`${part}-${index}`} className="floating-search-highlight">
        {part}
      </mark>
    );
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
