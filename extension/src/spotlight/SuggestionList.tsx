import { useState, useRef, useEffect, useMemo, forwardRef } from 'react';
import { getFaviconUrl } from '@shared/utils/favicon.js';
import type { Url } from '@shared/types/ids.js';
import type { SpotlightSuggestion, SpotlightSuggestionGroup } from './types.js';

type SuggestionListProps = {
  suggestions: SpotlightSuggestion[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (suggestion: SpotlightSuggestion) => void;
};

const GROUP_LABELS: Record<SpotlightSuggestionGroup, string> = {
  'open-tabs': 'Open Tabs',
  'recently-closed': 'Recently Closed',
  'current-tree': 'Current Tree',
  'other-trees': 'Other Trees',
};

const GROUP_ORDER: SpotlightSuggestionGroup[] = [
  'open-tabs',
  'recently-closed',
  'current-tree',
  'other-trees',
];

type GroupedSuggestions = {
  group: SpotlightSuggestionGroup;
  label: string;
  items: Array<{ suggestion: SpotlightSuggestion; flatIndex: number }>;
};

export function SuggestionList({
  suggestions,
  selectedIndex,
  onSelect,
  onActivate,
}: SuggestionListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Group suggestions by category, preserving flat index
  const groups = useMemo(() => {
    const grouped = new Map<SpotlightSuggestionGroup, GroupedSuggestions>();

    suggestions.forEach((suggestion, flatIndex) => {
      let group = grouped.get(suggestion.group);
      if (!group) {
        group = {
          group: suggestion.group,
          label: GROUP_LABELS[suggestion.group],
          items: [],
        };
        grouped.set(suggestion.group, group);
      }
      group.items.push({ suggestion, flatIndex });
    });

    // Return in defined order, skipping empty groups
    return GROUP_ORDER
      .map((key) => grouped.get(key))
      .filter((g): g is GroupedSuggestions => g !== undefined && g.items.length > 0);
  }, [suggestions]);

  // Auto-scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="spotlight-suggestions" ref={listRef}>
      {groups.map((group) => (
        <div key={group.group}>
          <div className="spotlight-group-header">{group.label}</div>
          {group.items.map(({ suggestion, flatIndex }) => (
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
      ))}
    </div>
  );
}

// ─── Item ───

type SuggestionItemProps = {
  suggestion: SpotlightSuggestion;
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
            {suggestion.group === 'other-trees' && suggestion.treeName
              ? suggestion.treeName
              : suggestion.title}
          </div>
          <div className="spotlight-item-url">{truncateUrl(suggestion.url)}</div>
        </div>
        {suggestion.isCurrent && <div className="spotlight-item-current" />}
        {suggestion.group === 'open-tabs' && !suggestion.isCurrent && (
          <div className="spotlight-item-tab-indicator" />
        )}
      </div>
    );
  },
);

// ─── Favicon with globe fallback ───

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

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}
