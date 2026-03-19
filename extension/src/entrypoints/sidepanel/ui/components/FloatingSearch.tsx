import React, { useEffect, useState, type RefObject } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { useSearch } from "../hooks/useSearch.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import SearchResultsList from "./SearchResultsList.js";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state sync on dep change
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
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const handleCollapse = () => {
    handleClear(false);
    setFocused(false);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!hasQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state sync on dep change
      setListOpen(false);
    }
  }, [hasQuery]);

  useEffect(() => {
    if (search.results.length === 0 && listOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state sync on dep change
      setListOpen(false);
    }
  }, [listOpen, search.results.length]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const handleSelectResult = (nodeId: NodeId) => {
    selectResult(nodeId);
    setListOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleToggleList = () => {
    if (search.results.length === 0) return;
    setListOpen((open) => !open);
  };

  return (
    <div
      className={`floating-search${expanded ? "expanded" : ""}${hasQuery ? "has-query" : ""}${listOpen ? "list-open" : ""}`}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextTarget)) {
          setFocused(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          handleCollapse();
        }
      }}
    >
      <div className="floating-search-panel">
        <div className="floating-search-input">
          <input
            ref={inputRef}
            type="text"
            className="floating-search-field"
            placeholder="search pages..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                nextResult();
              }
            }}
          />
          {expanded ? (
            <button
              className="floating-search-close"
              type="button"
              aria-label="Close search"
              onClick={handleCollapse}
            >
              <Icons.X size={14} />
            </button>
          ) : null}
          {!expanded ? (
            <button
              className="matte-circle-btn orb-button search-orb"
              type="button"
              aria-label={searchTooltip}
              data-tooltip={searchTooltip}
              onClick={() => inputRef.current?.focus()}
            >
              <Icons.Search size={18} />
            </button>
          ) : null}
        </div>
        <div className="floating-search-island" aria-hidden={!hasQuery}>
          <div className="floating-search-results-panel">
            <div className="floating-search-results">
              <span className="floating-search-count">
                {search.results.length === 0
                  ? "No matches"
                  : `${search.index + 1} of ${search.results.length}`}
              </span>
              <div className="floating-search-nav">
                <button
                  className={`floating-search-nav-btn${listOpen ? "is-active" : ""}`}
                  type="button"
                  aria-label="Results list"
                  data-tooltip="Results list"
                  onClick={handleToggleList}
                  disabled={!hasQuery || search.results.length === 0}
                  tabIndex={hasQuery ? 0 : -1}
                >
                  <Icons.List size={14} />
                </button>
                <button
                  className="floating-search-nav-btn"
                  type="button"
                  aria-label="Previous (↑)"
                  data-tooltip="Previous (↑)"
                  onClick={prevResult}
                  disabled={!hasQuery}
                  tabIndex={hasQuery ? 0 : -1}
                >
                  <Icons.ChevronUp size={14} />
                </button>
                <button
                  className="floating-search-nav-btn"
                  type="button"
                  aria-label="Next (↓)"
                  data-tooltip="Next (↓)"
                  onClick={nextResult}
                  disabled={!hasQuery}
                  tabIndex={hasQuery ? 0 : -1}
                >
                  <Icons.ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="floating-search-list-wrap" aria-hidden={!listOpen}>
          <div className="floating-search-list-panel">
            <SearchResultsList
              tree={tree}
              results={search.results}
              activeId={search.results[search.index] ?? null}
              query={search.query}
              onSelect={handleSelectResult}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
