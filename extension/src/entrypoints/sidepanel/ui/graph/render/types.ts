import type { NodeId } from '@shared/types/ids.js';
import type { NavigationNode } from '@shared/types/node.js';
import type { TabState } from '@shared/types/tabs.js';
import type { TagDefinition } from '@shared/types/tags.js';

export type GraphDisplayOptions = {
  titleTruncation: 'start' | 'middle' | 'end';
  showFavicons: boolean;
  showUrls: boolean;
  showTagDots: boolean;
  showTabCounts: boolean;
  showAudioIndicators: boolean;
  dimClosedNodes: boolean;
};

export type NodeRenderModel = {
  id: NodeId;
  node: NavigationNode;
  x: number;
  y: number;
  width: number;
  height: number;
  isCurrent: boolean;
  isOpen: boolean;
  openProgress: number;
  tabCount: number;
  tabState?: TabState;
  isCollapsed: boolean;
  isSelected: boolean;
  isPreview: boolean;
  isSearchMatch: boolean;
  isSearchFocused: boolean;
  isSearchDimmed: boolean;
  isHoverFocused: boolean;
  display: GraphDisplayOptions;
  tagDefs: Record<string, TagDefinition>;
  debugChildIndex?: number;
};

export type ConnectionSegment = {
  id: string;
  start: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  end: { x: number; y: number };
  onPath: boolean;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  style: 'bezier' | 'orthogonal';
};

export type ParticleRenderModel = {
  id: string;
  x: number;
  y: number;
  radius: number;
  alpha: number;
};
