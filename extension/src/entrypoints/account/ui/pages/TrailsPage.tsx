import { useState, useMemo } from 'react';
import type { RouteParams } from '../router.js';
import { useLocalTrails, type LocalTrailSummary } from '../hooks/useLocalTrails.js';
import TrailCard from '../components/TrailCard.js';

type SortOption = 'newest' | 'oldest' | 'name' | 'nodes';

function sortTrails(
  trails: LocalTrailSummary[],
  sort: SortOption,
): LocalTrailSummary[] {
  return [...trails].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return b.savedAt - a.savedAt;
      case 'oldest':
        return a.savedAt - b.savedAt;
      case 'name':
        return a.label.localeCompare(b.label);
      case 'nodes':
        return b.nodeCount - a.nodeCount;
    }
  });
}

export default function TrailsPage(_props: RouteParams) {
  const { trails, isLoading, error } = useLocalTrails();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? trails.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            (t.rootTitle?.toLowerCase().includes(q) ?? false) ||
            (t.rootUrl?.toLowerCase().includes(q) ?? false),
        )
      : trails;
    return sortTrails(base, sort);
  }, [trails, search, sort]);

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="account-page__header">
          <h1 className="account-page__title">Trails</h1>
        </div>
        <div className="account-empty">
          <p className="account-empty__text">Loading trails...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-page">
        <div className="account-page__header">
          <h1 className="account-page__title">Trails</h1>
        </div>
        <div className="account-error">
          <p className="account-error__text">
            Failed to load trails: {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (trails.length === 0) {
    return (
      <div className="account-page">
        <div className="account-page__header">
          <h1 className="account-page__title">Trails</h1>
          <a href="#/trails/import" className="account-btn account-btn--secondary">
            Import
          </a>
        </div>
        <div className="account-empty">
          <p className="account-empty__heading">No trails yet</p>
          <p className="account-empty__text">
            Start browsing with the Trail extension and your trails will appear
            here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-page__header">
        <h1 className="account-page__title">Trails</h1>
        <a href="#/trails/import" className="account-btn account-btn--secondary">
          Import
        </a>
      </div>

      <div className="trails-toolbar">
        <div className="trails-search">
          <svg
            className="trails-search__icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search trails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="trails-search__input"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="trails-sort"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A-Z</option>
          <option value="nodes">Most nodes</option>
        </select>
      </div>

      {filtered.length > 0 ? (
        <div className="trails-grid">
          {filtered.map((trail) => (
            <TrailCard key={trail.id} trail={trail} />
          ))}
        </div>
      ) : (
        <div className="account-empty">
          <p className="account-empty__heading">No matching trails</p>
          <p className="account-empty__text">
            Try adjusting your search query.
          </p>
        </div>
      )}
    </div>
  );
}
