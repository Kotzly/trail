import React, { useEffect, useState, type RefObject } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { useSearch } from "../hooks/useSearch.js";
import { useStore } from "../state/store.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "./Icon.js";
import SearchResultsList from "./SearchResultsList.js";
import { Button } from "@ui/components/ui/button";

type FloatingSearchProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onExpandedChange?: (expanded: boolean) => void;
};

export default function FloatingSearch({ inputRef, onExpandedChange }: FloatingSearchProps) {
  const metaKey = useStore((state) => state.metaKey);
  const { search, performSearch, clearSearch, nextResult, prevResult, selectResult } = useSearch();
  const tree = useStore((state) => state.tree);
  const [draft, setDraft] = useState(search.query);
  const [listOpen, setListOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasQuery = search.query.length > 0;
  const expanded = hasQuery || focused;
  const searchShortcut = metaKey
    ? `${metaKey.short}+F / ${metaKey.short}+K / /`
    : "Ctrl+F / Ctrl+K / /";
  const searchTooltip = `Search (${searchShortcut})`;

  useEffect(() => {
    setDraft(search.query);
  }, [search.query]);

  useEffect(() => {
    if (draft === search.query) return;
    const handle = window.setTimeout(() => {
      if (draft !== search.query) {
        performSearch(draft);
      }
    }, 150);
    return () => window.clearTimeout(handle);
  }, [draft, performSearch, search.query]);

  const handleClear = (shouldFocus = true) => {
    setDraft("");
    setListOpen(false);
    clearSearch();
    if (shouldFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleCollapse = () => {
    handleClear(false);
    setFocused(false);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!hasQuery) setListOpen(false);
  }, [hasQuery]);

  useEffect(() => {
    if (search.results.length === 0 && listOpen) setListOpen(false);
  }, [listOpen, search.results.length]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const handleSelectResult = (nodeId: NodeId) => {
    selectResult(nodeId);
    setListOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleToggleList = () => {
    if (search.results.length === 0) return;
    setListOpen((open) => !open);
  };

  return (
    <div
      className="pointer-events-auto"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); handleCollapse(); }
      }}
    >
      {/* Search input bar / orb */}
      <div className={cn(
        "flex items-center bg-background/90 backdrop-blur-sm border border-border shadow-sm transition-all duration-150 overflow-hidden",
        expanded ? "w-[clamp(140px,calc(100vw-184px),220px)] rounded-lg px-2.5 gap-1.5" : "w-8 h-8 rounded-full justify-center",
      )}>
        {expanded && <Icons.Search className="size-3.5 text-muted-foreground shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "bg-transparent text-[13px] outline-none placeholder:text-muted-foreground min-w-0 transition-all",
            expanded ? "flex-1 py-1.5 opacity-100" : "w-0 p-0 opacity-0",
          )}
          placeholder="search pages..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextResult(); } }}
        />
        {expanded ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full shrink-0"
            type="button"
            aria-label="Close search"
            onClick={handleCollapse}
          >
            <Icons.X />
          </Button>
        ) : (
          <Button
            id="searchBtn"
            variant="ghost"
            size="icon-sm"
            className="rounded-full size-8"
            type="button"
            aria-label={searchTooltip}
            data-tooltip={searchTooltip}
            onClick={() => inputRef.current?.focus()}
          >
            <Icons.Search />
          </Button>
        )}
      </div>

      {/* Keyboard hints */}
      {expanded && focused && (
        <div className="flex gap-2.5 px-2 py-1 text-[10px] text-muted-foreground/70">
          <span><kbd className="font-semibold opacity-90">Enter</kbd> next</span>
          <span><kbd className="font-semibold opacity-90">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold opacity-90">Esc</kbd> close</span>
        </div>
      )}

      {/* Results counter + navigation */}
      {expanded && hasQuery && (
        <div className="flex items-center justify-between bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-sm px-2.5 py-1.5 mt-1.5">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {search.results.length === 0
              ? "No matches"
              : `${search.index + 1} of ${search.results.length}`}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              type="button"
              aria-label="Results list"
              data-tooltip="Results list"
              onClick={handleToggleList}
              disabled={!hasQuery || search.results.length === 0}
            >
              <Icons.List className={cn(listOpen && "text-foreground")} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              type="button"
              aria-label="Previous (↑)"
              data-tooltip="Previous (↑)"
              onClick={prevResult}
              disabled={!hasQuery}
            >
              <Icons.ChevronUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              type="button"
              aria-label="Next (↓)"
              data-tooltip="Next (↓)"
              onClick={nextResult}
              disabled={!hasQuery}
            >
              <Icons.ChevronDown />
            </Button>
          </div>
        </div>
      )}

      {/* Results list */}
      {listOpen && (
        <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-sm overflow-hidden max-h-[260px] mt-1.5">
          <SearchResultsList
            tree={tree}
            results={search.results}
            activeId={search.results[search.index] ?? null}
            query={search.query}
            onSelect={handleSelectResult}
          />
        </div>
      )}
    </div>
  );
}
