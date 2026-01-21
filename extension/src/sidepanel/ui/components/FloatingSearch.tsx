import type { RefObject } from 'react';
import React, { useEffect, useState } from 'react';
import type { NodeId } from '../../../shared/types/ids.js';
import { useSearch } from '../hooks/useSearch.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import SearchResultsList from './SearchResultsList.js';

type FloatingSearchProps = {
  inputRef: RefObject<HTMLInputElement>;
};

export default function FloatingSearch({ inputRef }: FloatingSearchProps) {
  const {
    search,
    performSearch,
    clearSearch,
    nextResult,
    prevResult,
    selectResult,
  } = useSearch();
  const tree = useStore((state) => state.tree);
  const [draft, setDraft] = useState(search.query);
  const [listOpen, setListOpen] = useState(false);
  const hasQuery = search.query.length > 0;

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

  const handleClear = () => {
    setDraft('');
    setListOpen(false);
    clearSearch();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!hasQuery) {
      setListOpen(false);
    }
  }, [hasQuery]);

  useEffect(() => {
    if (search.results.length === 0 && listOpen) {
      setListOpen(false);
    }
  }, [listOpen, search.results.length]);

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
    <div className={`floating-search ${hasQuery ? 'expanded has-query' : ''}${listOpen ? ' list-open' : ''}`}>
      <button
        className="matte-circle-btn orb-button search-orb"
        type="button"
        title="Search (Ctrl+F)"
        onClick={() => inputRef.current?.focus()}
      >
        <Icons.Search size={18} />
      </button>

      <div className="floating-search-panel" data-notify-anchor={hasQuery ? 'true' : undefined}>
        <div className="floating-search-input">
          <input
            ref={inputRef}
            type="text"
            className="floating-search-field"
            placeholder="search pages..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                handleClear();
              } else if (event.key === 'Enter') {
                event.preventDefault();
                nextResult();
              }
            }}
          />
          {hasQuery ? (
            <button
              className="floating-search-clear"
              type="button"
              title="Clear search"
              onClick={handleClear}
            >
              <Icons.X size={14} />
            </button>
          ) : null}
        </div>
        <div className="floating-search-island" aria-hidden={!hasQuery}>
          <div className="floating-search-results-panel">
            <div className="floating-search-results">
              <span className="floating-search-count">
                {search.results.length === 0
                  ? 'No results'
                  : `${search.index + 1} of ${search.results.length}`}
              </span>
              <div className="floating-search-nav">
                <button
                  className={`floating-search-nav-btn${listOpen ? ' is-active' : ''}`}
                  type="button"
                  title="Results list"
                  onClick={handleToggleList}
                  disabled={!hasQuery || search.results.length === 0}
                  tabIndex={hasQuery ? 0 : -1}
                >
                  <Icons.List size={14} />
                </button>
                <button
                  className="floating-search-nav-btn"
                  type="button"
                  title="Previous (↑)"
                  onClick={prevResult}
                  disabled={!hasQuery}
                  tabIndex={hasQuery ? 0 : -1}
                >
                  <Icons.ChevronUp size={14} />
                </button>
                <button
                  className="floating-search-nav-btn"
                  type="button"
                  title="Next (↓)"
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
