import type { RefObject } from 'react';
import { useSearch } from '../hooks/useSearch.js';
import { Icons } from './Icon.js';


type SearchBarProps = {
  inputRef: RefObject<HTMLInputElement | null>;
};

export default function SearchBar({ inputRef }: SearchBarProps) {
  const { search, performSearch, clearSearch, nextResult, prevResult } = useSearch();
  const hasQuery = search.query.length > 0;

  return (
    <div className="search-bar" id="searchBar">
      <div className="search-input-wrapper">
        <Icons.Search className="search-icon" size={16} />
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
          aria-label="Clear search"
          data-tooltip="Clear search"
          onClick={clearSearch}
        >
          <Icons.X size={16} />
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
          <button
            className="search-nav-btn"
            id="searchPrev"
            type="button"
            aria-label="Previous (↑)"
            data-tooltip="Previous (↑)"
            onClick={prevResult}
          >
            <Icons.ChevronUp size={16} />
          </button>
          <button
            className="search-nav-btn"
            id="searchNext"
            type="button"
            aria-label="Next (↓)"
            data-tooltip="Next (↓)"
            onClick={nextResult}
          >
            <Icons.ChevronDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
