import { useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId } from '../../../../shared/types/ids.js';
import type { TabState } from '../../../../shared/types/tabs.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import type { NodePosition } from '../../graph/types.js';
import { TAG_PRESETS } from '../../graph/tags.js';
import { formatUrl } from '../../shared/format.js';
import React from 'react';


type GraphNodeProps = {
  node: NavigationNode;
  position: NodePosition;
  nodeWidth: number;
  nodeHeight: number;
  currentId: NodeId | null;
  openNodeIds: Set<NodeId> | null;
  nodeTabCounts: Record<NodeId, number>;
  tabState?: TabState;
  isSelected: boolean;
  isPreview: boolean;
  isSearchMatch: boolean;
  isSearchFocused: boolean;
  isSearchDimmed: boolean;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

export default function GraphNode({
  node,
  position,
  nodeWidth,
  nodeHeight,
  currentId,
  openNodeIds,
  nodeTabCounts,
  tabState,
  isSelected,
  isPreview,
  isSearchMatch,
  isSearchFocused,
  isSearchDimmed,
  onClick,
  onContextMenu,
}: GraphNodeProps) {
  const [faviconError, setFaviconError] = useState(false);
  const tabCount = nodeTabCounts[node.id];
  const hasTags = node.data.tags && node.data.tags.length > 0;

  const className = useMemo(() => {
    const classes = ['graph-node'];
    if (node.id === currentId) classes.push('current');
    if (openNodeIds && !openNodeIds.has(node.id)) classes.push('closed');
    if (tabState?.sound.muted) classes.push('muted');
    if (node.data.pinned) classes.push('pinned');
    if (isSelected) classes.push('selected');
    if (isPreview) classes.push('selected-preview');
    if (isSearchDimmed) classes.push('search-dimmed');
    if (isSearchMatch) classes.push('search-match');
    if (isSearchFocused) classes.push('search-focused');
    return classes.join(' ');
  }, [
    currentId,
    isPreview,
    isSearchDimmed,
    isSearchFocused,
    isSearchMatch,
    isSelected,
    node.data.pinned,
    node.id,
    openNodeIds,
    tabState?.sound.muted,
  ]);

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
    >
      {node.data.pinned && (
        <div className="graph-node-pin" title="Pinned">
          <svg viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </div>
      )}
      <div className="graph-node-favicon">
        {node.data.favicon && !faviconError ? (
          <img
            src={node.data.favicon}
            alt=""
            onError={() => setFaviconError(true)}
          />
        ) : (
          '🌐'
        )}
      </div>
      <div className="graph-node-content">
        <div className="graph-node-title">{node.data.title || 'Untitled'}</div>
        <div className="graph-node-url">{formatUrl(node.data.url)}</div>
      </div>
      {tabCount && tabCount > 1 ? (
        <div className="graph-node-tab-count" title={`${tabCount} tabs open for this page`}>
          {tabCount}x
        </div>
      ) : null}
      {hasTags && (
        <div className="graph-node-tags">
          {node.data.tags?.map((tagId) => {
            const tagPreset = TAG_PRESETS.find((tag) => tag.id === tagId);
            if (!tagPreset) return null;
            return (
              <span
                key={tagPreset.id}
                className="graph-node-tag-dot"
                style={{ backgroundColor: tagPreset.color }}
                title={tagPreset.label}
              />
            );
          })}
        </div>
      )}
      {tabState?.sound.audible && (
        <div
          className="graph-node-audio"
          title={tabState.sound.muted ? 'Unmute tab' : 'Mute tab'}
          onClick={(event) => event.stopPropagation()}
        >
          {tabState.sound.muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
