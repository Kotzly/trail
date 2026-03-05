import type { NodeId } from '@shared/types/ids.js';
import type { SpotlightSuggestionGroup } from '@shared/rpc/contracts.js';

export type LegacySpotlightSearchSessionId = string;

export type LegacySpotlightHighlightRange = {
  start: number;
  end: number;
};

export type LegacySpotlightHighlightMap = {
  title: LegacySpotlightHighlightRange[];
  url: LegacySpotlightHighlightRange[];
};

export type LegacySpotlightSearchResult = {
  nodeId: NodeId;
  title: string;
  url: string;
  favicon?: string;
  group: SpotlightSuggestionGroup;
  recency: number;
  isCurrent: boolean;
  treeId?: string;
  treeName?: string;
  score: number;
  groupBadge: 'Open' | 'Recent' | 'Tree' | 'Archived';
  highlights: LegacySpotlightHighlightMap;
};

export type LegacySpotlightSearchResponse = {
  requestSeq: number;
  results: LegacySpotlightSearchResult[];
};

export type LegacySpotlightBootstrapData = {
  sessionId: LegacySpotlightSearchSessionId;
  results: LegacySpotlightSearchResult[];
  tree: unknown;
  currentNodeId: NodeId | null;
  openNodeIds: NodeId[];
  nodeRecency: Record<NodeId, number>;
  nodeTabCounts: Record<NodeId, number>;
  settings: unknown;
};
