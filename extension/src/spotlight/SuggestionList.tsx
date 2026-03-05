import { useState, useRef, useEffect, forwardRef, Fragment, type ReactNode } from 'react';
import { getFaviconUrl } from '@shared/utils/favicon.js';
import type { Url } from '@shared/types/ids.js';
import type { SpotlightSearchResult, SpotlightHighlightRange } from './types.js';

type SuggestionListProps = {
  suggestions: SpotlightSearchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (suggestion: SpotlightSearchResult) => void;
};

export function SuggestionList({
  suggestions,
  selectedIndex,
  onSelect,
  onActivate,
}: SuggestionListProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="spotlight-suggestions">
      {suggestions.map((suggestion, flatIndex) => (
        <SuggestionItem
          key={`${suggestion.group}-${suggestion.nodeId}-${suggestion.treeId ?? ''}`}
          ref={flatIndex === selectedIndex ? selectedRef : undefined}
          suggestion={suggestion}
          selected={flatIndex === selectedIndex}
          onMouseEnter={() => onSelect(flatIndex)}
          onClick={() => onActivate(suggestion)}
        />
      ))}
    </div>
  );
}

type SuggestionItemProps = {
  suggestion: SpotlightSearchResult;
  selected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
};

const SuggestionItem = forwardRef<HTMLDivElement, SuggestionItemProps>(
  function SuggestionItem({ suggestion, selected, onMouseEnter, onClick }, ref) {
    const faviconSrc = suggestion.favicon || getFaviconUrl(suggestion.url as Url, 16);

    return (
      <div
        ref={ref}
        className="spotlight-item"
        data-selected={selected}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      >
        <Favicon src={faviconSrc} />
        <div className="spotlight-item-text">
          <div className="spotlight-item-title">
            {renderHighlighted(
              suggestion.group === 'other-trees' && suggestion.treeName ? suggestion.treeName : suggestion.title,
              suggestion.highlights.title,
            )}
          </div>
          <div className="spotlight-item-url">
            {renderHighlighted(suggestion.url, suggestion.highlights.url)}
          </div>
        </div>
        <div className={`spotlight-item-badge spotlight-item-badge--${suggestion.group}`}>
          {suggestion.groupBadge}
        </div>
        {suggestion.isCurrent && <div className="spotlight-item-current" />}
      </div>
    );
  },
);

function Favicon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <GlobeIcon />;

  return (
    <img
      className="spotlight-item-favicon"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function GlobeIcon() {
  return (
    <svg
      className="spotlight-item-favicon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.35 }}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12" />
      <path d="M8 2a10.5 10.5 0 0 1 2.8 6 10.5 10.5 0 0 1-2.8 6" />
      <path d="M8 2a10.5 10.5 0 0 0-2.8 6 10.5 10.5 0 0 0 2.8 6" />
    </svg>
  );
}

function renderHighlighted(text: string, ranges: SpotlightHighlightRange[]) {
  if (!text || ranges.length === 0) return text;

  const safeRanges = ranges
    .filter((range) => range.start < range.end && range.start >= 0 && range.end <= text.length)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (safeRanges.length === 0) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < safeRanges.length; i += 1) {
    const range = safeRanges[i]!;
    if (range.start > cursor) {
      parts.push(<Fragment key={`p-${i}`}>{text.slice(cursor, range.start)}</Fragment>);
    }
    parts.push(
      <mark key={`m-${i}`} className="spotlight-highlight">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }

  if (cursor < text.length) {
    parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  }

  return parts;
}
