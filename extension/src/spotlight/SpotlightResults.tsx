import type { ReactNode, RefObject } from 'react';
import { Command } from 'cmdk';
import { motion } from 'motion/react';
import { SpotlightRowIcon } from './SpotlightRowIcon.js';
import { SpotlightRowActions } from './SpotlightRowActions.js';
import { highlightText } from './highlight.js';
import type { SpotlightActionId, SpotlightActionTarget, SpotlightSearchResult, SpotlightSection } from './types.js';
import type { IndicatorPosition } from './useSelectionIndicator.js';

type SpotlightResultsProps = {
  listRef: RefObject<HTMLElement | null>;
  sections: SpotlightSection[];
  selectedKey: string | null;
  selectedKeys: Set<string>;
  collapsedSections: Set<string>;
  indicatorPos: IndicatorPosition;
  activeTreeId: string | null;
  drilldownTransition: string;
  onToggleSection: (id: string) => void;
  onActivate: (item: SpotlightSearchResult) => Promise<void>;
  onInlineAction: (actionId: SpotlightActionId, target: SpotlightActionTarget, statusText: string) => void;
};

export function SpotlightResults({
  listRef,
  sections,
  selectedKey,
  selectedKeys,
  collapsedSections,
  indicatorPos,
  activeTreeId,
  drilldownTransition,
  onToggleSection,
  onActivate,
  onInlineAction,
}: SpotlightResultsProps) {
  return (
    <Command.List ref={listRef as React.Ref<HTMLDivElement>} className="spotlight-sections" data-transition={drilldownTransition}>
      {indicatorPos && (
        <motion.div
          className="spotlight-selection-indicator"
          animate={{ y: indicatorPos.top, height: indicatorPos.height }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      {sections.map((section, i) => {
        const collapsed = collapsedSections.has(section.id);
        return (
          <Command.Group
            key={section.id}
            heading={
              <button type="button" className="spotlight-section-toggle" onClick={() => onToggleSection(section.id)} tabIndex={-1} aria-label={collapsed ? 'Expand section' : 'Collapse section'} aria-expanded={!collapsed}>
                <span className="spotlight-section-chevron" data-collapsed={collapsed} />
                {section.title}
                <span className="spotlight-section-count">{section.items.length}</span>
              </button>
            }
            className="spotlight-section" data-first={i === 0} data-collapsed={collapsed}
          >
            {!collapsed && section.items.map((item) => (
              <Command.Item
                key={item.key} value={item.key}
                className={`spotlight-row spotlight-row--${item.kind}`}
                data-destructive={item.kind === 'action' && item.safety === 'destructive'}
                data-multi-selected={selectedKeys.has(item.key)}
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
                onSelect={() => { void onActivate(item); }}
              >
                <SpotlightRowIcon item={item} />
                <div className="spotlight-row-main">
                  <div className="spotlight-row-title">{renderItemTitle(item)}</div>
                  <div className="spotlight-row-subtitle">{renderItemSubtitle(item)}</div>
                </div>
                {item.key === selectedKey && item.kind !== 'action' ? (
                  <SpotlightRowActions item={item} activeTreeId={activeTreeId} onAction={onInlineAction} />
                ) : (
                  <div className="spotlight-row-meta">{getItemMeta(item)}</div>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        );
      })}
    </Command.List>
  );
}

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

function getItemMeta(item: SpotlightSearchResult): string {
  if (item.kind === 'node') return item.group === 'other-trees' ? item.treeName : item.pinned ? 'Pinned' : item.groupBadge;
  return item.kind === 'tree' ? item.groupBadge : item.shortcutHint;
}
