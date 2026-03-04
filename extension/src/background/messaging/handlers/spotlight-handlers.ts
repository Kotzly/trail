import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  type SpotlightSuggestion,
  type SpotlightSuggestionGroup,
} from '@shared/rpc/contracts.js';
import { treeStorage } from '../../services/tree-storage.js';
import { tabManager } from '../../state/tab-manager.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import { settingsManager } from '../../services/settings.js';
import type { NodeId } from '@shared/types/ids.js';

export const spotlightHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_SPOTLIGHT_DATA]() {
    const tree = await treeStorage.getOrCreateTree();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const currentNodeId = tree.getCurrentId();
    const openNodeSet = new Set(tabManager.openNodes());
    const openNodeIds = Array.from(openNodeSet);
    const settings = settingsManager.get();

    // Build recency + tab count maps
    const nodeRecency: Record<string, number> = {};
    const nodeTabCounts: Record<string, number> = {};
    for (const nodeId of openNodeIds) {
      const r = tabManager.getNodeRecency(nodeId);
      if (r > 0) nodeRecency[nodeId] = r;
      nodeTabCounts[nodeId] = tabManager.tabCountForNode(nodeId);
    }

    // Build suggestions from tree nodes
    const suggestions: SpotlightSuggestion[] = [];

    for (const node of tree.iter()) {
      const isOpen = openNodeSet.has(node.id);
      const isCurrent = node.id === currentNodeId;
      const recency = nodeRecency[node.id] ?? node.data.lastVisitedAt ?? node.timestamp ?? 0;

      let group: SpotlightSuggestionGroup;
      if (isOpen) {
        group = 'open-tabs';
      } else if (recency > 0) {
        group = 'recently-closed';
      } else {
        group = 'current-tree';
      }

      suggestions.push({
        nodeId: node.id,
        title: node.data.title || 'Untitled',
        url: node.data.url,
        favicon: node.data.favicon,
        group,
        recency,
        isCurrent,
      });
    }

    // Add archived trees as "other trees" entries
    const archived = await treeStorage.getArchivedSummaries();
    for (const entry of archived.slice(0, 20)) {
      suggestions.push({
        nodeId: 0 as NodeId,
        title: entry.rootTitle || entry.label,
        url: entry.rootUrl || '',
        favicon: entry.rootFavicon,
        group: 'other-trees',
        recency: entry.savedAt ?? 0,
        isCurrent: false,
        treeId: entry.id,
        treeName: entry.label,
      });
    }

    // Sort within groups: open tabs by recency desc, then current tree by recency desc
    suggestions.sort((a, b) => {
      const groupOrder: Record<SpotlightSuggestionGroup, number> = {
        'open-tabs': 0,
        'recently-closed': 1,
        'current-tree': 2,
        'other-trees': 3,
      };
      const groupDiff = groupOrder[a.group] - groupOrder[b.group];
      if (groupDiff !== 0) return groupDiff;
      return b.recency - a.recency;
    });

    return ok({
      suggestions,
      tree: treeJSON,
      currentNodeId,
      openNodeIds,
      nodeRecency,
      nodeTabCounts,
      settings,
    });
  },

  async [RPC_METHOD.TOGGLE_SPOTLIGHT]() {
    // This is handled by the content script directly via message listener.
    // Background just forwards the message to the active tab.
    return ok();
  },
});
