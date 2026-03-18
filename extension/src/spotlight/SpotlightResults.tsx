import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SpotlightRowIcon } from './SpotlightRowIcon.js';
import { SpotlightRowActions } from './SpotlightRowActions.js';
import { highlightText } from './highlight.js';
import type { SpotlightActionId, SpotlightActionTarget, SpotlightSearchResult, SpotlightSection } from './types.js';
import type { IndicatorPosition } from './useSelectionIndicator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VirtualRow =
  | { type: 'header'; sectionId: string; title: string; itemCount: number; collapsed: boolean }
  | { type: 'item'; item: SpotlightSearchResult; sectionId: string };

type SpotlightResultsProps = {
  listRef: RefObject<HTMLElement | null>;
  sections: SpotlightSection[];
  selectedKey: string | null;
  selectedKeys: Set<string>;
  collapsedSections: Set<string>;
  indicatorPos: IndicatorPosition;
  activeTreeId: string | null;
  drilldownTransition: string;
  rowHeight?: number;
  onToggleSection: (id: string) => void;
  onSelect: (key: string) => void;
  onActivate: (item: SpotlightSearchResult) => Promise<void>;
  onInlineAction: (actionId: SpotlightActionId, target: SpotlightActionTarget, statusText: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenSections(
  sections: SpotlightSection[],
  collapsedSections: Set<string>,
): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (const section of sections) {
    const collapsed = collapsedSections.has(section.id);
    rows.push({
      type: 'header',
      sectionId: section.id,
      title: section.title,
      itemCount: section.items.length,
      collapsed,
    });
    if (!collapsed) {
      for (const item of section.items) {
        rows.push({ type: 'item', item, sectionId: section.id });
      }
    }
  }
  return rows;
}

const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 42;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpotlightResults({
  listRef,
  sections,
  selectedKey,
  selectedKeys,
  collapsedSections,
  indicatorPos,
  activeTreeId,
  drilldownTransition,
  rowHeight = ROW_HEIGHT,
  onToggleSection,
  onSelect,
  onActivate,
  onInlineAction,
}: SpotlightResultsProps) {
  const rows = useMemo(
    () => flattenSections(sections, collapsedSections),
    [sections, collapsedSections],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => (rows[index]!.type === 'header' ? HEADER_HEIGHT : rowHeight),
    overscan: 8,
    paddingStart: 8,
    paddingEnd: 8,
  });

  // Invalidate cached measurements when rows change (e.g. section collapse)
  useEffect(() => {
    virtualizer.measure();
  }, [rows, virtualizer]);

  const isHoverRef = useRef(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-scroll to selected item — debounced center on hover, instant on keyboard
  useEffect(() => {
    if (!selectedKey) return;
    const index = rows.findIndex(
      (r) => r.type === 'item' && r.item.key === selectedKey,
    );
    if (index === -1) return;

    if (isHoverRef.current) {
      // Don't auto-scroll list on hover — let the user control scroll position
      isHoverRef.current = false;
      return;
    }
    clearTimeout(hoverTimerRef.current);
    virtualizer.scrollToIndex(index, { align: 'auto' });
  }, [selectedKey, rows, virtualizer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(hoverTimerRef.current);
  }, []);

  return (
    <div
      ref={listRef as React.Ref<HTMLDivElement>}
      className="spotlight-sections"
      data-transition={drilldownTransition}
      role="listbox"
      aria-label="Search results"
      aria-activedescendant={selectedKey ? 'spotlight-active-item' : undefined}
      style={{ overflowY: 'auto', maxHeight: '100%' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {indicatorPos && (
          <div
            className="spotlight-selection-indicator"
            style={{ transform: `translateY(${indicatorPos.top}px)`, height: indicatorPos.height }}
          />
        )}
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = rows[virtualItem.index]!;

          if (row.type === 'header') {
            return (
              <div
                key={`header-${row.sectionId}`}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="spotlight-section-heading">
                  <button
                    type="button"
                    className="spotlight-section-toggle"
                    onClick={() => onToggleSection(row.sectionId)}
                    tabIndex={-1}
                    aria-label={row.collapsed ? 'Expand section' : 'Collapse section'}
                    aria-expanded={!row.collapsed}
                  >
                    <span className="spotlight-section-chevron" data-collapsed={row.collapsed} />
                    {row.title}
                    <span className="spotlight-section-count">{row.itemCount}</span>
                  </button>
                </div>
              </div>
            );
          }

          const { item } = row;
          const isSelected = item.key === selectedKey;

          return (
            <div
              key={item.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                boxSizing: 'border-box',
                paddingLeft: 8,
                paddingRight: 8,
              }}
            >
              <div
                className={`spotlight-row spotlight-row--${item.kind}`}
                data-selected={isSelected}
                data-destructive={item.kind === 'action' && item.safety === 'destructive'}
                data-multi-selected={selectedKeys.has(item.key)}
                id={isSelected ? 'spotlight-active-item' : undefined}
                role="option"
                aria-selected={isSelected}
                aria-description={
                  item.kind === 'action' && item.safety === 'destructive'
                    ? 'Destructive action'
                    : undefined
                }
                draggable={item.kind === 'node' || item.kind === 'tree'}
                onDragStart={(e) => {
                  if (item.kind === 'node') {
                    e.dataTransfer.setData('text/uri-list', item.url);
                    e.dataTransfer.setData('text/plain', `${item.title}\n${item.url}`);
                    e.dataTransfer.effectAllowed = 'copyLink';
                  } else if (item.kind === 'tree' && item.rootUrl) {
                    e.dataTransfer.setData('text/uri-list', item.rootUrl);
                    e.dataTransfer.setData('text/plain', `${item.treeName}\n${item.rootUrl}`);
                    e.dataTransfer.effectAllowed = 'copyLink';
                  }
                }}
                onMouseEnter={() => { isHoverRef.current = true; onSelect(item.key); }}
                onClick={() => { onSelect(item.key); void onActivate(item); }}
              >
                <SpotlightRowIcon item={item} />
                <div className="spotlight-row-main">
                  <div className="spotlight-row-title">{renderItemTitle(item)}</div>
                  <div className="spotlight-row-subtitle">{renderItemSubtitle(item)}</div>
                </div>
                {isSelected && item.kind !== 'action' ? (
                  <SpotlightRowActions item={item} activeTreeId={activeTreeId} onAction={onInlineAction} />
                ) : (
                  <>
                    {item.kind !== 'action' && item.groupBadge && (
                      <span className={`spotlight-source-badge spotlight-source-badge--${badgeVariant(item)}`}>
                        {item.groupBadge}
                      </span>
                    )}
                    {item.kind === 'action' && (
                      <div className="spotlight-row-meta">{item.shortcutHint}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Render helpers (unchanged from original)
// ---------------------------------------------------------------------------

function renderItemTitle(item: SpotlightSearchResult): ReactNode {
  return item.kind === 'node' ? highlightText(item.title, item.highlights.title)
    : item.kind === 'tree' ? highlightText(item.treeName, item.highlights.title)
    : item.title;
}

function renderItemSubtitle(item: SpotlightSearchResult): ReactNode {
  if (item.kind === 'node') {
    return <span className="spotlight-mono">{highlightText(item.url, item.highlights.url)}</span>;
  }
  if (item.kind === 'tree') {
    if (!item.rootUrl) return 'Archived tree';
    return <span className="spotlight-mono">{highlightText(item.rootUrl, item.highlights.url)}</span>;
  }
  if (item.subtitle.startsWith('http')) {
    return <span className="spotlight-mono">{item.subtitle}</span>;
  }
  return item.subtitle;
}

function badgeVariant(item: SpotlightSearchResult): string {
  if (item.kind === 'action') return '';
  if (item.kind === 'node') {
    if (item.groupBadge === 'Open') return 'tab';
    if (item.pinned) return 'pin';
  }
  return '';
}
