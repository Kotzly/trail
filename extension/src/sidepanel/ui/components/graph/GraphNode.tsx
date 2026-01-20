import { useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { TabState } from '../../../../shared/types/tabs.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import type { NodePosition } from '../../graph/types.js';
import type { TitleTruncation } from '../../../../shared/types/settings.js';
import type { TagDefinition } from '../../../../shared/types/tags.js';
import { formatUrl } from '../../shared/format.js';
import { Icons } from '../Icon.js';
import React from 'react';

type GraphNodeDisplay = {
  titleTruncation: TitleTruncation;
  showFavicons: boolean;
  showUrls: boolean;
  showTagDots: boolean;
  showTabCounts: boolean;
  showAudioIndicators: boolean;
  dimClosedNodes: boolean;
};

type GraphNodeSelection = {
  isSelected: boolean;
  isPreview: boolean;
  isSearchMatch: boolean;
  isSearchFocused: boolean;
  isSearchDimmed: boolean;
  isHoverFocused: boolean;
};

type GraphNodeProps = {
  node: NavigationNode;
  position: NodePosition;
  nodeWidth: number;
  nodeHeight: number;
  isCurrent: boolean;
  isOpen: boolean;
  tabCount: number;
  tabState?: TabState;
  tagDefs: Record<string, TagDefinition>;
  display: GraphNodeDisplay;
  selection: GraphNodeSelection;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function GraphNode({
  node,
  position,
  nodeWidth,
  nodeHeight,
  isCurrent,
  isOpen,
  tabCount,
  tabState,
  tagDefs,
  display,
  selection,
  onClick,
  onContextMenu,
  onPointerDown,
}: GraphNodeProps) {
  const [faviconError, setFaviconError] = useState(false);
  const hasTags = node.data.tags && node.data.tags.length > 0;

  const className = useMemo(() => {
    const classes = ['graph-node'];
    if (isCurrent) classes.push('current');
    if (!isOpen && display.dimClosedNodes) classes.push('closed');
    if (tabState?.sound.muted) classes.push('muted');
    if (node.data.pinned) classes.push('pinned');
    if (selection.isSelected) classes.push('selected');
    if (selection.isPreview) classes.push('selected-preview');
    if (selection.isSearchDimmed) classes.push('search-dimmed');
    if (selection.isSearchMatch) classes.push('search-match');
    if (selection.isSearchFocused) classes.push('search-focused');
    if (selection.isHoverFocused) classes.push('hover-focused');
    return classes.join(' ');
  }, [
    display.dimClosedNodes,
    isCurrent,
    isOpen,
    selection.isPreview,
    selection.isSearchDimmed,
    selection.isSearchFocused,
    selection.isSearchMatch,
    selection.isSelected,
    selection.isHoverFocused,
    node.data.pinned,
    node.id,
    tabState?.sound.muted,
  ]);

  const fullTitle = node.data.title || 'Untitled';
  const maxTitleChars = Math.max(10, Math.floor((nodeWidth - 70) / 6.5));
  const displayTitle = useMemo(
    () => truncateTitle(fullTitle, display.titleTruncation, maxTitleChars),
    [display.titleTruncation, fullTitle, maxTitleChars],
  );

  return (
    <div
      className={className}
      data-node-id={node.id}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${nodeWidth}px`,
        height: `${nodeHeight}px`,
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
      {node.data.pinned && (
        <div className="graph-node-pin" title="Pinned">
          <Icons.Pin size={16} />
        </div>
      )}
      {display.showFavicons ? (
        <div className="graph-node-favicon">
          {node.data.favicon && !faviconError ? (
            <img src={node.data.favicon} alt="" onError={() => setFaviconError(true)} />
          ) : (
            '🌐'
          )}
        </div>
      ) : null}
      <div className="graph-node-content">
        <div className="graph-node-title" title={fullTitle}>
          {displayTitle}
        </div>
        {display.showUrls ? <div className="graph-node-url">{formatUrl(node.data.url)}</div> : null}
      </div>
      {display.showTabCounts && tabCount > 1 ? (
        <div className="graph-node-tab-count" title={`${tabCount} tabs open for this page`}>
          {tabCount}x
        </div>
      ) : null}
      {display.showTagDots && hasTags && (
        <div className="graph-node-tags">
          {node.data.tags?.map((tagId) => {
            const tagPreset = tagDefs[tagId];
            if (!tagPreset) return null;
            return (
              <span
                key={tagPreset.id as string}
                className="graph-node-tag-dot"
                style={{ backgroundColor: tagPreset.color }}
                title={tagPreset.label}
              >
              </span>
            );
          })}
        </div>
      )}
      {display.showAudioIndicators && tabState?.sound.audible && (
        <div
          className="graph-node-audio"
          title={tabState.sound.muted ? 'Unmute tab' : 'Mute tab'}
          onClick={(event) => event.stopPropagation()}
        >
          {tabState.sound.muted ? <Icons.VolumeX size={16} /> : <Icons.Volume2 size={16} />}
        </div>
      )}
    </div>
  );
}

export default React.memo(GraphNode);

function truncateTitle(text: string, mode: TitleTruncation, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return '…';
  const ellipsis = '…';
  const available = maxChars - 1;
  if (mode === 'start') {
    return `${ellipsis}${text.slice(text.length - available)}`;
  }
  if (mode === 'middle') {
    const left = Math.ceil(available / 2);
    const right = Math.floor(available / 2);
    return `${text.slice(0, left)}${ellipsis}${text.slice(text.length - right)}`;
  }
  return `${text.slice(0, available)}${ellipsis}`;
}
