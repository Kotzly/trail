import type { RefObject } from 'react';
import { useSearch } from '../hooks/useSearch.js';
import { Icons } from './Icon.js';
import React from 'react';

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
    acceptSelection,
    cancelSelection,
  } = useSearch();
  const hasQuery = search.query.length > 0;
  const handleClear = () => {
    clearSearch();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  return (
    <div className={`floating-search ${hasQuery ? 'expanded has-query' : ''}`}>
      <button
        className="btn-icon orb-button search-orb"
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
            value={search.query}
            onChange={(event) => performSearch(event.target.value)}
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
        <div className="floating-search-actions-wrap" aria-hidden={!hasQuery}>
          <div className="floating-search-actions">
            <button
              className="floating-search-action-btn"
              type="button"
              title="Accept selection"
              onClick={acceptSelection}
              disabled={!hasQuery || search.results.length === 0}
              tabIndex={hasQuery ? 0 : -1}
            >
              <Icons.Check size={14} />
            </button>
            <button
              className="floating-search-action-btn"
              type="button"
              title="Cancel selection"
              onClick={cancelSelection}
              disabled={!hasQuery}
              tabIndex={hasQuery ? 0 : -1}
            >
              <Icons.X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
