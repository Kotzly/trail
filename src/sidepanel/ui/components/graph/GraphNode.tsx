import { useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId } from '../../../../shared/types/ids.js';
import type { TabState } from '../../../../shared/types/tabs.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import type { NodePosition } from '../../graph/types.js';
import { TAG_PRESETS } from '../../graph/tags.js';
import { formatUrl } from '../../shared/format.js';
import { Icons } from '../Icon.js';
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
          <Icons.Pin size={16} />
        </div>
      )}
      <div className="graph-node-favicon">
        {node.data.favicon && !faviconError ? (
          <img src={node.data.favicon} alt="" onError={() => setFaviconError(true)} />
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
          {tabState.sound.muted ? <Icons.VolumeX size={16} /> : <Icons.Volume2 size={16} />}
        </div>
      )}
    </div>
  );
}
