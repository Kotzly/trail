import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FaviconUrl, NodeId, Timestamp, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import type { NavigationTree } from "@background/state/nav-tree.js";
import { formatTime, formatUrl } from "../shared/format.js";
import { cn } from "../lib/utils.js";
import { Icons } from "./Icon.js";

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

const ROW_HEIGHT = 52;

export default function SearchResultsList({
  tree,
  results,
  activeId,
  query,
  onSelect,
}: SearchResultsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const items = useMemo<SearchResultItem[]>(() => {
    if (!tree) return [];
    const next: SearchResultItem[] = [];
    for (const id of results) {
      const node = tree.findNodeById(id);
      if (!node) continue;
      const favicon = node.data.favicon;
      next.push({
        id,
        title: node.data.title || "Untitled",
        url: node.data.url,
        timestamp: node.timestamp,
        ...(favicon !== undefined ? { favicon } : {}),
      });
    }
    return next;
  }, [results, tree]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  useEffect(() => {
    if (activeId == null) return;
    const idx = items.findIndex((item) => item.id === activeId);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [activeId, items, virtualizer]);

  if (items.length === 0) {
    return <div className="py-3.5 text-center text-[11px] text-muted-foreground">No results</div>;
  }

  return (
    <div ref={parentRef} className="overflow-auto p-1.5" style={{ maxHeight: 260 }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SearchResultRow
                item={item}
                query={query}
                isActive={activeId === item.id}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SearchResultRowProps = {
  item: SearchResultItem;
  query: string;
  isActive: boolean;
  onSelect: (id: NodeId) => void;
};

const SearchResultRow = memo(function SearchResultRow({
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
      className={cn(
        "flex items-center gap-2 w-full rounded-md border border-border px-2.5 py-2 text-left cursor-pointer transition-colors hover:bg-accent",
        isActive && "bg-accent border-border",
      )}
      type="button"
      onClick={() => onSelect(item.id)}
    >
      <div className="size-5.5 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden" aria-hidden="true">
        {!faviconError ? (
          <img className="size-4 rounded object-cover" src={getFaviconUrl(item.url)} alt="" onError={() => setFaviconError(true)} />
        ) : (
          <Icons.Search className="size-3 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="text-xs truncate">{title}</div>
        <div className="text-[10px] text-muted-foreground truncate">{url}</div>
      </div>
      <div className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">{formatTime(item.timestamp)}</div>
    </button>
  );
});

function renderHighlight(text: string, query: string): ReactNode {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  const escaped = tokens.map(escapeRegExp);
  const pattern = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts = text.split(pattern);
  return parts.map((part, index) => {
    const match = tokens.some((token) => token.toLowerCase() === part.toLowerCase());
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    return (
      <mark key={`${part}-${index}`} className="bg-accent text-accent-foreground rounded-sm">
        {part}
      </mark>
    );
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
