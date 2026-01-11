import type { RefObject } from 'react';
import { useSearch } from '../hooks/useSearch.js';
import React from 'react';

type SearchBarProps = {
  inputRef: RefObject<HTMLInputElement>;
};

export default function SearchBar({ inputRef }: SearchBarProps) {
  const { search, performSearch, clearSearch, nextResult, prevResult } = useSearch();
  const hasQuery = search.query.length > 0;

  return (
    <div className="search-bar" id="searchBar">
      <div className="search-input-wrapper">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          id="searchInput"
          className="search-input"
          placeholder="search pages... (Ctrl+F)"
          value={search.query}
          onChange={(event) => performSearch(event.target.value)}
        />
        <button
          className={`search-clear ${hasQuery ? '' : 'hidden'}`}
          id="searchClear"
          type="button"
          title="Clear search"
          onClick={clearSearch}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className={`search-results ${hasQuery ? '' : 'hidden'}`} id="searchResults">
        <span className="search-count" id="searchCount">
          {!hasQuery
            ? '0 results found'
            : search.results.length === 0
            ? 'No results'
            : `${search.index + 1} of ${search.results.length}`}
        </span>
        <div className="search-nav">
          <button className="search-nav-btn" id="searchPrev" type="button" title="Previous (↑)" onClick={prevResult}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button className="search-nav-btn" id="searchNext" type="button" title="Next (↓)" onClick={nextResult}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
