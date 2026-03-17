import { useEffect, useState } from 'react';
import type { BookmarkItem } from './useBookmarks.js';
import type { SpotlightSearchResult } from '../../../spotlight/types.js';
import { getFaviconUrl } from '@shared/utils/favicon.js';
import type { Url } from '@shared/types/ids.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DashboardViewProps = {
  readonly bookmarks: readonly BookmarkItem[];
  readonly recentQueries: readonly string[];
  readonly continueItems: SpotlightSearchResult[];
  readonly onQueryChange: (q: string) => void;
  readonly onActivate: (item: SpotlightSearchResult) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Greeting({ time, text }: { readonly time: string; readonly text: string }) {
  return (
    <div className="newtab-greeting">
      <div className="newtab-greeting-time">{time}</div>
      <div className="newtab-greeting-text">{text}</div>
    </div>
  );
}

function BookmarksCard({
  bookmarks,
}: {
  readonly bookmarks: readonly BookmarkItem[];
}) {
  if (bookmarks.length === 0) return null;

  return (
    <div className="newtab-bento-card">
      <div className="newtab-bento-card-title">Bookmarks</div>
      <div className="newtab-bento-bookmarks-grid">
        {bookmarks.map((bm) => (
          <a
            key={bm.id}
            href={bm.url ?? '#'}
            className="newtab-bento-item"
            title={bm.title}
          >
            {bm.url && (
              <img
                className="newtab-bento-item-icon"
                src={getFaviconUrl(bm.url as Url, 20)}
                alt=""
                width={20}
                height={20}
              />
            )}
            <span className="newtab-bento-item-text">{bm.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ContinueCard({
  items,
  onActivate,
}: {
  readonly items: SpotlightSearchResult[];
  readonly onActivate: (item: SpotlightSearchResult) => Promise<void>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="newtab-bento-card newtab-bento-card--wide">
      <div className="newtab-bento-card-title">Pick Up Where You Left Off</div>
      <div className="newtab-bento-continue-grid">
        {items.map((item) => {
          const url = item.kind === 'node' ? item.url : item.kind === 'tree' ? item.rootUrl : undefined;
          const title = item.kind === 'action' ? item.title : item.kind === 'node' ? item.title : item.treeName;
          const subtitle = item.kind === 'action' ? item.subtitle : item.kind === 'node' ? domainOf(item.url) : '';

          return (
            <button
              key={item.key}
              type="button"
              className="newtab-bento-item"
              onClick={() => void onActivate(item)}
            >
              {url && (
                <img
                  className="newtab-bento-item-icon"
                  src={getFaviconUrl(url as Url, 20)}
                  alt=""
                  width={20}
                  height={20}
                />
              )}
              <span className="newtab-bento-item-text">
                <span className="newtab-bento-item-title">{title}</span>
                {subtitle && <span className="newtab-bento-item-subtitle">{subtitle}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecentSearchesCard({
  queries,
  onQueryChange,
}: {
  readonly queries: readonly string[];
  readonly onQueryChange: (q: string) => void;
}) {
  if (queries.length === 0) return null;

  return (
    <div className="newtab-bento-card">
      <div className="newtab-bento-card-title">Recent Searches</div>
      <div className="newtab-bento-pills">
        {queries.map((q) => (
          <button
            key={q}
            type="button"
            className="newtab-bento-pill"
            onClick={() => onQueryChange(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardView({
  bookmarks,
  recentQueries,
  continueItems,
  onQueryChange,
  onActivate,
}: DashboardViewProps) {
  const [time, setTime] = useState(getTime);
  const [greeting, setGreeting] = useState(getGreeting);

  useEffect(() => {
    const tick = () => { setTime(getTime()); setGreeting(getGreeting()); };
    // Align to next minute boundary for accurate clock display
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
    const timeout = setTimeout(() => { tick(); interval = setInterval(tick, 60_000); }, msToNextMinute);
    let interval: ReturnType<typeof setInterval> | undefined;
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, []);

  return (
    <div className="newtab-dashboard">
      <Greeting time={time} text={greeting} />
      <div className="newtab-bento">
        <ContinueCard items={continueItems} onActivate={onActivate} />
        <BookmarksCard bookmarks={bookmarks} />
        <RecentSearchesCard queries={recentQueries} onQueryChange={onQueryChange} />
      </div>
    </div>
  );
}
