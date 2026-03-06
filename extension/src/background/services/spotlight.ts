import { parseSpotlightQuery, type SpotlightToken } from '@shared/lib/spotlight/query-dsl.js';
import { scoreSpotlightCandidate } from '@shared/lib/spotlight/scoring.js';
import {
  normalizeSpotlightSearchQuery,
  normalizeSpotlightUrlCandidate,
} from '@shared/lib/spotlight/external.js';
import {
  type SpotlightActionId,
  type SpotlightActionResult,
  type SpotlightActionSafety,
  type SpotlightActionTarget,
  type SpotlightBootstrapData,
  type SpotlightGraphPreviewData,
  type SpotlightMode,
  type SpotlightNodeResult,
  type SpotlightSearchResponse,
  type SpotlightSearchSessionId,
  type SpotlightSearchResult,
  type SpotlightSection,
  type SpotlightSuggestionGroup,
  type SpotlightTreeRelation,
  type SpotlightTreeResult,
} from '@shared/rpc/contracts.js';
import type { NodeId } from '@shared/types/ids.js';
import { getAllFlags } from './flags.js';
import {
  computeGraphBoosts,
  spotlightLiveIndex,
  type SpotlightLiveDoc,
  type SpotlightLiveNodeDoc,
  type SpotlightLiveSnapshot,
  type SpotlightLiveTreeDoc,
} from './spotlight-live-index.js';
import { spotlightUsageStats } from './spotlight-usage-stats.js';
import { settingsManager } from './settings.js';

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_RESULTS = 80;

const SECTION_TITLES: Record<SpotlightSection['id'], string> = {
  'continue': 'Continue',
  'actions': 'Actions',
  'pins': 'Pins',
  'open-tabs': 'Open Tabs',
  'recent': 'Recent',
  'current-tree': 'Current Tree',
  'other-trees': 'Other Tree Pages',
  'archived-trees': 'Trees',
  'trees': 'Trees',
  'external': 'External',
  'matches': 'Matches',
  'scoped-pages': 'Pages',
  'frequent': 'Frequently Used',
  'recent-searches': 'Recent Searches',
};

type SpotlightSession = {
  id: SpotlightSearchSessionId;
  openedAt: number;
  lastTouchedAt: number;
  baseIndexVersion: number;
};

export class SpotlightService {
  private sessions = new Map<SpotlightSearchSessionId, SpotlightSession>();

  async bootstrap(limit: number): Promise<SpotlightBootstrapData> {
    this.pruneExpiredSessions();
    await spotlightLiveIndex.buildInitialIndex();
    const snapshot = await spotlightLiveIndex.getSnapshot();
    const session = this.createSession(snapshot.version);
    const mode: SpotlightMode = 'discover';
    const sections = await this.buildSections(snapshot, mode, '', limit);

    const recentQueries = await spotlightUsageStats.getRecentQueries();

    return {
      sessionId: session.id,
      mode,
      sections,
      activeTreeId: snapshot.activeTreeId,
      activeTreeName: snapshot.activeTreeName,
      tree: snapshot.tree,
      currentNodeId: snapshot.currentNodeId,
      openNodeIds: snapshot.openNodeIds,
      nodeRecency: snapshot.nodeRecency,
      nodeTabCounts: snapshot.nodeTabCounts,
      recentQueries,
      flags: getAllFlags(),
      settings: settingsManager.get(),
    };
  }

  async search(
    sessionId: SpotlightSearchSessionId,
    query: string,
    limit: number,
    requestSeq: number,
    scopeTreeId?: string,
  ): Promise<SpotlightSearchResponse> {
    this.pruneExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SESSION_EXPIRED');
    }

    session.lastTouchedAt = Date.now();
    const snapshot = await spotlightLiveIndex.getSnapshot();
    const { mode, normalizedQuery } = resolveSpotlightMode(query);
    const sections = await this.buildSections(snapshot, mode, normalizedQuery, limit, scopeTreeId);

    return {
      requestSeq,
      mode,
      sections,
    };
  }

  async getTreePreview(treeId: string): Promise<SpotlightGraphPreviewData | null> {
    await spotlightLiveIndex.buildInitialIndex();
    const snapshot = await spotlightLiveIndex.getSnapshot();
    return snapshot.previewsByTreeId.get(treeId) ?? null;
  }

  dispose(sessionId: SpotlightSearchSessionId): void {
    this.sessions.delete(sessionId);
  }

  async recordSelection(
    actionId: SpotlightActionId,
    target: SpotlightActionTarget | undefined,
    query: string,
  ): Promise<void> {
    const key = actionTargetKey(actionId, target);
    if (!key) return;
    const normalizedQuery = resolveSpotlightMode(query).normalizedQuery;
    const ast = parseSpotlightQuery(normalizedQuery);
    const tokens = collectPositivePlainTokens(ast.clauses.flatMap((clause) => clause.terms));
    await spotlightUsageStats.record(key, tokens);
    if (normalizedQuery) {
      await spotlightUsageStats.recordQuery(normalizedQuery);
    }
  }

  private createSession(baseIndexVersion: number): SpotlightSession {
    const now = Date.now();
    const id = `spotlight-v3-${now}-${Math.random().toString(16).slice(2)}`;
    const session: SpotlightSession = {
      id,
      openedAt: now,
      lastTouchedAt: now,
      baseIndexVersion,
    };
    this.sessions.set(id, session);
    return session;
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastTouchedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  private async buildSections(
    snapshot: SpotlightLiveSnapshot,
    mode: SpotlightMode,
    query: string,
    limit: number,
    scopeTreeId?: string,
  ): Promise<SpotlightSection[]> {
    if (mode === 'commands') {
      return this.buildCommandSections(snapshot, query);
    }
    if (scopeTreeId) {
      return mode === 'discover'
        ? this.buildScopedDiscoverSections(snapshot, scopeTreeId, limit)
        : this.buildScopedSearchSections(snapshot, scopeTreeId, query, limit);
    }
    if (mode === 'discover') {
      return this.buildDiscoverSections(snapshot, limit);
    }
    return this.buildSearchSections(snapshot, query, limit);
  }

  private async buildDiscoverSections(
    snapshot: SpotlightLiveSnapshot,
    limit: number,
  ): Promise<SpotlightSection[]> {
    const seen = new Set<string>();
    const sections: SpotlightSection[] = [];
    const activeNodeDocs = snapshot.nodeDocs.filter((doc) => doc.treeId === snapshot.activeTreeId);
    const currentDoc = snapshot.currentNodeId
      ? activeNodeDocs.find((doc) => doc.nodeId === snapshot.currentNodeId) ?? null
      : null;

    const continueDocs: SpotlightNodeResult[] = [];
    if (currentDoc) {
      pushUnique(seen, continueDocs, await this.toNodeResult(snapshot, currentDoc, 0, []));
      if (currentDoc.parentId) {
        const parentDoc = activeNodeDocs.find((doc) => doc.nodeId === currentDoc.parentId) ?? null;
        if (parentDoc) {
          pushUnique(seen, continueDocs, await this.toNodeResult(snapshot, parentDoc, 0, []));
        }
      }
      const childDoc = [...activeNodeDocs]
        .filter((doc) => doc.parentId === currentDoc.nodeId)
        .sort(compareNodeDocsByPriority)[0];
      if (childDoc) {
        pushUnique(seen, continueDocs, await this.toNodeResult(snapshot, childDoc, 0, []));
      }
      const siblingDoc = [...activeNodeDocs]
        .filter((doc) => doc.parentId === currentDoc.parentId && doc.nodeId !== currentDoc.nodeId)
        .sort(compareNodeDocsByPriority)[0];
      if (siblingDoc && continueDocs.length < 4) {
        pushUnique(seen, continueDocs, await this.toNodeResult(snapshot, siblingDoc, 0, []));
      }
    }
    appendSectionIfAny(sections, 'continue', continueDocs.slice(0, 4));

    const frequentKeys = await spotlightUsageStats.getTopTargetKeys(5);
    const frequentItems: SpotlightSearchResult[] = [];
    for (const key of frequentKeys) {
      const doc = snapshot.docsByKey.get(key);
      if (!doc || seen.has(doc.key)) continue;
      if (doc.kind === 'node') {
        pushUnique(seen, frequentItems, await this.toNodeResult(snapshot, doc, 0, []) as SpotlightSearchResult);
      }
    }
    appendSectionIfAny(sections, 'frequent', frequentItems);

    const pins = await this.mapNodes(
      snapshot,
      [...activeNodeDocs].filter((doc) => doc.pinned).sort(compareNodeDocsByPriority),
      Math.min(Math.max(limit, 1), 8),
      seen,
    );
    appendSectionIfAny(sections, 'pins', pins);

    const currentTree = await this.mapNodes(
      snapshot,
      [...activeNodeDocs].sort(compareNodeDocsByPriority),
      Math.min(Math.max(limit, 1), 10),
      seen,
    );
    appendSectionIfAny(sections, 'current-tree', currentTree);

    const archivedTrees = await this.mapTrees(
      snapshot,
      [...snapshot.treeDocs].sort((a, b) => b.recency - a.recency),
      Math.min(Math.max(limit, 1), 8),
      seen,
    );
    appendSectionIfAny(sections, 'archived-trees', archivedTrees);

    const actionRows = buildGlobalActions().map((action) => toActionResult(action));
    appendSectionIfAny(sections, 'actions', actionRows);

    return sections;
  }

  private async buildSearchSections(
    snapshot: SpotlightLiveSnapshot,
    query: string,
    limit: number,
  ): Promise<SpotlightSection[]> {
    const searchLimit = Math.max(Math.min(limit || MAX_RESULTS, MAX_RESULTS), 1);
    const ranked = await this.rankEntities(snapshot, query, Math.max(searchLimit * 4, 40));
    const sections: SpotlightSection[] = [];

    const currentTreeMatches = ranked
      .filter((item): item is SpotlightNodeResult => item.kind === 'node' && item.treeId === snapshot.activeTreeId)
      .slice(0, Math.min(searchLimit, 12));
    appendSectionIfAny(sections, 'current-tree', currentTreeMatches);

    const otherTreeMatches = ranked
      .filter((item): item is SpotlightNodeResult => item.kind === 'node' && item.treeId !== snapshot.activeTreeId)
      .slice(0, Math.min(searchLimit, 12));
    appendSectionIfAny(sections, 'other-trees', otherTreeMatches);

    const treeMatches = ranked
      .filter((item): item is SpotlightTreeResult => item.kind === 'tree')
      .slice(0, Math.min(searchLimit, 8));
    appendSectionIfAny(sections, 'trees', treeMatches);

    const externalActions = buildExternalActions(query).map((action) => toActionResult(action));
    appendSectionIfAny(sections, 'external', externalActions);

    const topEntity = ranked[0] ?? null;
    const contextualActions = buildContextualActions(topEntity, snapshot.activeTreeId);
    appendSectionIfAny(
      sections,
      'actions',
      contextualActions.map((action) => toActionResult(action)).slice(0, 4),
    );

    return sections;
  }

  private async buildScopedDiscoverSections(
    snapshot: SpotlightLiveSnapshot,
    scopeTreeId: string,
    limit: number,
  ): Promise<SpotlightSection[]> {
    const sections: SpotlightSection[] = [];
    const seen = new Set<string>();
    const scopedDocs = snapshot.nodeDocs.filter((doc) => doc.treeId === scopeTreeId);

    const pages = await this.mapNodes(
      snapshot,
      [...scopedDocs].sort(compareNodeDocsByPriority),
      Math.min(Math.max(limit, 1), 40),
      seen,
    );
    appendSectionIfAny(sections, 'scoped-pages', pages);

    const treeDoc = snapshot.treeDocs.find((d) => d.treeId === scopeTreeId);
    if (treeDoc) {
      const actions = buildScopedTreeActions(treeDoc);
      appendSectionIfAny(sections, 'actions', actions.map((a) => toActionResult(a)));
    }

    return sections;
  }

  private async buildScopedSearchSections(
    snapshot: SpotlightLiveSnapshot,
    scopeTreeId: string,
    query: string,
    limit: number,
  ): Promise<SpotlightSection[]> {
    const searchLimit = Math.max(Math.min(limit || MAX_RESULTS, MAX_RESULTS), 1);
    const ranked = await this.rankEntities(snapshot, query, Math.max(searchLimit * 4, 40));
    const sections: SpotlightSection[] = [];

    const scopedMatches = ranked
      .filter((item): item is SpotlightNodeResult => item.kind === 'node' && item.treeId === scopeTreeId)
      .slice(0, searchLimit);
    appendSectionIfAny(sections, 'matches', scopedMatches);

    const treeDoc = snapshot.treeDocs.find((d) => d.treeId === scopeTreeId);
    if (treeDoc) {
      const actions = buildScopedTreeActions(treeDoc);
      appendSectionIfAny(sections, 'actions', actions.map((a) => toActionResult(a)));
    }

    return sections;
  }

  private buildCommandSections(snapshot: SpotlightLiveSnapshot, query: string): SpotlightSection[] {
    const q = query.trim().toLowerCase();
    const currentDoc = snapshot.currentNodeId
      ? snapshot.nodeDocs.find(
          (doc) => doc.treeId === snapshot.activeTreeId && doc.nodeId === snapshot.currentNodeId,
        ) ?? null
      : null;
    const actions = [
      ...buildGlobalActions(),
      ...buildCommandActionsForCurrentNode(currentDoc),
    ].filter((action) => {
      if (!q) return true;
      const haystack = `${action.title} ${action.subtitle}`.toLowerCase();
      return haystack.includes(q);
    });

    return [{
      id: 'actions',
      title: SECTION_TITLES.actions,
      items: actions.map((action) => toActionResult(action)),
    }];
  }

  private async rankEntities(
    snapshot: SpotlightLiveSnapshot,
    query: string,
    limit: number,
  ): Promise<Array<SpotlightNodeResult | SpotlightTreeResult>> {
    const ast = parseSpotlightQuery(query);
    const tokens = ast.clauses.flatMap((clause) => clause.terms);
    const queryDomains = extractQueryDomains(tokens);
    const queryUrls = extractQueryUrls(tokens);
    const needles = collectHighlightNeedles(tokens);
    const queryTokens = collectPositivePlainTokens(tokens);
    const firstPositiveToken = queryTokens[0]?.toLowerCase() ?? '';
    const textScores = new Map<string, number>();

    for (const clause of ast.clauses) {
      const positiveTerms = clause.terms.filter((term) => !term.negated && !term.field);
      const clauseCandidates = positiveTerms.length > 0
        ? (snapshot.index.search(
            positiveTerms.map((term) => term.value).join(' '),
            { combineWith: 'AND', prefix: true, fuzzy: 0.25 },
          ) as Array<{ key?: string; id?: string; score: number }>)
        : Array.from(snapshot.docsByKey.keys()).map((key) => ({ key, score: 0 }));

      for (const candidate of clauseCandidates) {
        const docKey = 'key' in candidate ? candidate.key : candidate.id;
        if (!docKey) continue;
        const doc = snapshot.docsByKey.get(docKey);
        if (!doc) continue;
        if (!matchesClause(doc, clause.terms)) continue;
        const previous = textScores.get(doc.key);
        if (previous === undefined || candidate.score > previous) {
          textScores.set(doc.key, candidate.score);
        }
      }
    }

    const ranked = await Promise.all(
      Array.from(textScores.entries()).map(async ([key, rawTextScore]) => {
        const doc = snapshot.docsByKey.get(key);
        if (!doc) return null;
        if (doc.kind === 'node') {
          return this.toRankedNode(
            snapshot,
            doc,
            rawTextScore,
            queryDomains,
            queryUrls,
            queryTokens,
            firstPositiveToken,
            needles,
          );
        }
        return this.toRankedTree(doc, rawTextScore, queryDomains, queryUrls, queryTokens, firstPositiveToken, needles);
      }),
    );

    return ranked
      .filter((item): item is SpotlightNodeResult | SpotlightTreeResult => Boolean(item))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.recency !== a.recency) return b.recency - a.recency;
        return getEntityLabel(a).localeCompare(getEntityLabel(b));
      })
      .slice(0, Math.max(1, Math.min(limit || MAX_RESULTS, MAX_RESULTS)));
  }

  private async toRankedNode(
    snapshot: SpotlightLiveSnapshot,
    doc: SpotlightLiveNodeDoc,
    rawTextScore: number,
    queryDomains: string[],
    queryUrls: string[],
    queryTokens: string[],
    firstPositiveToken: string,
    needles: string[],
  ): Promise<SpotlightNodeResult> {
    const usage = await spotlightUsageStats.getBoosts(doc.key, queryTokens);
    const graph = computeGraphBoosts(
      doc,
      snapshot.activeTreeId,
      snapshot.currentNodeId,
      snapshot.currentPath,
    );
    const breakdown = scoreSpotlightCandidate({
      nodeId: doc.nodeId,
      title: doc.title,
      url: doc.url,
      domain: doc.domain,
      group: doc.group,
      recency: doc.recency,
      isCurrent: doc.isCurrent,
      tabCount: doc.tabCount,
      exactPrefixMatch: Boolean(firstPositiveToken) && doc.title.toLowerCase().startsWith(firstPositiveToken),
      graphProximityBoost: graph.graphProximityBoost,
      branchAffinityBoost: graph.branchAffinityBoost,
      selectionFrequencyBoost: usage.selectionFrequencyBoost,
      selectionTokenAffinityBoost: usage.selectionTokenAffinityBoost,
    }, {
      textScore: rawTextScore,
      queryDomains,
      queryUrls,
    }, Date.now());

    return {
      kind: 'node',
      key: doc.key,
      nodeId: doc.nodeId,
      title: doc.title,
      url: doc.url,
      favicon: doc.favicon,
      group: doc.group,
      recency: doc.recency,
      isCurrent: doc.isCurrent,
      treeRelation: graph.relation,
      tabCount: doc.tabCount,
      pinned: doc.pinned,
      treeId: doc.treeId,
      treeName: doc.treeName,
      score: breakdown.finalScore,
      groupBadge: toGroupBadge(doc.group),
      highlights: {
        title: findRanges(doc.title, needles),
        url: findRanges(doc.url, needles),
      },
      why: buildWhyChips(doc.group, graph.relation, breakdown, doc.tabCount, doc.pinned),
    };
  }

  private async toRankedTree(
    doc: SpotlightLiveTreeDoc,
    rawTextScore: number,
    queryDomains: string[],
    queryUrls: string[],
    queryTokens: string[],
    firstPositiveToken: string,
    needles: string[],
  ): Promise<SpotlightTreeResult> {
    const usage = await spotlightUsageStats.getBoosts(doc.key, queryTokens);
    const breakdown = scoreSpotlightCandidate({
      nodeId: 0 as NodeId,
      title: doc.treeName,
      url: doc.rootUrl,
      domain: doc.domain,
      group: doc.group,
      recency: doc.recency,
      isCurrent: false,
      tabCount: 0,
      exactPrefixMatch: Boolean(firstPositiveToken) && doc.treeName.toLowerCase().startsWith(firstPositiveToken),
      selectionFrequencyBoost: usage.selectionFrequencyBoost,
      selectionTokenAffinityBoost: usage.selectionTokenAffinityBoost,
    }, {
      textScore: rawTextScore,
      queryDomains,
      queryUrls,
    }, Date.now());

    return {
      kind: 'tree',
      key: doc.key,
      treeId: doc.treeId,
      treeName: doc.treeName,
      rootUrl: doc.rootUrl,
      favicon: doc.favicon,
      recency: doc.recency,
      score: breakdown.finalScore,
      groupBadge: 'Archived',
      highlights: {
        title: findRanges(doc.treeName, needles),
        url: findRanges(doc.rootUrl, needles),
      },
      why: buildTreeWhyChips(breakdown),
    };
  }

  private async toNodeResult(
    snapshot: SpotlightLiveSnapshot,
    doc: SpotlightLiveNodeDoc,
    rawTextScore: number,
    needles: string[],
  ): Promise<SpotlightNodeResult> {
    const graph = computeGraphBoosts(
      doc,
      snapshot.activeTreeId,
      snapshot.currentNodeId,
      snapshot.currentPath,
    );
    return {
      kind: 'node',
      key: doc.key,
      nodeId: doc.nodeId,
      title: doc.title,
      url: doc.url,
      favicon: doc.favicon,
      group: doc.group,
      recency: doc.recency,
      isCurrent: doc.isCurrent,
      treeRelation: graph.relation,
      tabCount: doc.tabCount,
      pinned: doc.pinned,
      treeId: doc.treeId,
      treeName: doc.treeName,
      score: rawTextScore,
      groupBadge: toGroupBadge(doc.group),
      highlights: {
        title: findRanges(doc.title, needles),
        url: findRanges(doc.url, needles),
      },
      why: buildWhyChips(doc.group, graph.relation, null, doc.tabCount, doc.pinned),
    };
  }

  private async mapNodes(
    snapshot: SpotlightLiveSnapshot,
    docs: SpotlightLiveNodeDoc[],
    limit: number,
    seen: Set<string>,
  ): Promise<SpotlightNodeResult[]> {
    const items: SpotlightNodeResult[] = [];
    for (const doc of docs) {
      if (seen.has(doc.key)) continue;
      const item = await this.toNodeResult(snapshot, doc, 0, []);
      items.push(item);
      seen.add(doc.key);
      if (items.length >= limit) break;
    }
    return items;
  }

  private async mapTrees(
    _snapshot: SpotlightLiveSnapshot,
    docs: SpotlightLiveTreeDoc[],
    limit: number,
    seen: Set<string>,
  ): Promise<SpotlightTreeResult[]> {
    const items: SpotlightTreeResult[] = [];
    for (const doc of docs) {
      if (seen.has(doc.key)) continue;
      items.push({
        kind: 'tree',
        key: doc.key,
        treeId: doc.treeId,
        treeName: doc.treeName,
        rootUrl: doc.rootUrl,
        favicon: doc.favicon,
        recency: doc.recency,
        score: 0,
        groupBadge: 'Archived',
        highlights: { title: [], url: [] },
        why: ['archived'],
      });
      seen.add(doc.key);
      if (items.length >= limit) break;
    }
    return items;
  }
}

function resolveSpotlightMode(query: string): { mode: SpotlightMode; normalizedQuery: string } {
  const trimmed = query.trim();
  if (!trimmed) return { mode: 'discover', normalizedQuery: '' };
  if (trimmed.startsWith('>') || trimmed.startsWith('/')) {
    return { mode: 'commands', normalizedQuery: trimmed.slice(1).trim() };
  }
  return { mode: 'search', normalizedQuery: trimmed };
}

function appendSectionIfAny(
  sections: SpotlightSection[],
  id: SpotlightSection['id'],
  items: SpotlightSearchResult[],
): void {
  if (items.length === 0) return;
  sections.push({ id, title: SECTION_TITLES[id], items });
}

function pushUnique<T extends SpotlightSearchResult>(seen: Set<string>, list: T[], item: T): void {
  if (seen.has(item.key)) return;
  seen.add(item.key);
  list.push(item);
}

function compareNodeDocsByPriority(a: SpotlightLiveNodeDoc, b: SpotlightLiveNodeDoc): number {
  if (Number(b.pinned) !== Number(a.pinned)) {
    return Number(b.pinned) - Number(a.pinned);
  }
  if (b.tabCount !== a.tabCount) {
    return b.tabCount - a.tabCount;
  }
  return b.recency - a.recency;
}

function buildGlobalActions(): ActionSeed[] {
  return [
    {
      actionId: 'new-tree',
      title: 'New tree',
      subtitle: 'Archive current context and start a fresh tree',
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'global' },
    },
    {
      actionId: 'archive-current-tree',
      title: 'Archive current tree',
      subtitle: 'Move the active tree into archived trees',
      safety: 'destructive',
      shortcutHint: 'Alt+Enter',
      target: { kind: 'global' },
    },
    {
      actionId: 'export-tree',
      title: 'Export current tree',
      subtitle: 'Download the active tree as JSON',
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'global' },
    },
    {
      actionId: 'show-command-help',
      title: 'Show command help',
      subtitle: 'Open search syntax and command mode help',
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'global' },
    },
    {
      actionId: 'open-settings',
      title: 'Open settings',
      subtitle: 'Open Trail extension settings',
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'global' },
    },
    {
      actionId: 'toggle-sidebar',
      title: 'Toggle sidebar',
      subtitle: 'Show or hide the Trail sidebar',
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'global' },
    },
    {
      actionId: 'clear-history',
      title: 'Clear search history',
      subtitle: 'Reset all usage statistics and recent queries',
      safety: 'destructive',
      shortcutHint: 'Alt+Enter',
      target: { kind: 'global' },
    },
  ];
}

function buildCommandActionsForCurrentNode(currentDoc: SpotlightLiveNodeDoc | null): ActionSeed[] {
  if (!currentDoc) return [];
  const actions: ActionSeed[] = [
    {
      actionId: currentDoc.pinned ? 'unpin' : 'pin',
      title: currentDoc.pinned ? 'Unpin current page' : 'Pin current page',
      subtitle: currentDoc.title,
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'node', nodeId: currentDoc.nodeId, treeId: currentDoc.treeId },
    },
  ];
  if (currentDoc.tabCount > 0) {
    actions.push({
      actionId: currentDoc.tabCount > 1 ? 'close-tabs' : 'close-tab',
      title: currentDoc.tabCount > 1 ? 'Close tabs for current page' : 'Close current tab',
      subtitle: currentDoc.title,
      safety: 'destructive',
      shortcutHint: 'Alt+Enter',
      target: { kind: 'node', nodeId: currentDoc.nodeId, treeId: currentDoc.treeId },
    });
  }
  return actions;
}

function buildContextualActions(
  result: SpotlightNodeResult | SpotlightTreeResult | null,
  activeTreeId: string,
): ActionSeed[] {
  if (!result) return [];

  if (result.kind === 'node') {
    const isForeign = result.treeId !== activeTreeId;
    const actions: ActionSeed[] = [
      {
        actionId: isForeign ? 'open-node-in-tree' : 'open',
        title: isForeign ? 'Open in tree' : 'Open',
        subtitle: isForeign ? `${result.treeName} • ${result.title}` : result.title,
        safety: 'safe',
        shortcutHint: 'Enter',
        target: { kind: 'node', nodeId: result.nodeId, treeId: result.treeId },
      },
      {
        actionId: 'open-url-only',
        title: 'Open URL only',
        subtitle: result.url,
        safety: 'safe',
        shortcutHint: 'Enter',
        target: { kind: 'url', url: result.url },
      },
      {
        actionId: 'copy-url',
        title: 'Copy URL',
        subtitle: result.url,
        safety: 'safe',
        shortcutHint: 'Enter',
        target: { kind: 'node', nodeId: result.nodeId, treeId: result.treeId },
      },
    ];
    if (!isForeign) {
      actions.push({
        actionId: result.pinned ? 'unpin' : 'pin',
        title: result.pinned ? 'Unpin page' : 'Pin page',
        subtitle: result.title,
        safety: 'safe',
        shortcutHint: 'Enter',
        target: { kind: 'node', nodeId: result.nodeId, treeId: result.treeId },
      });
      if (result.tabCount > 0) {
        actions.push({
          actionId: result.tabCount > 1 ? 'close-tabs' : 'close-tab',
          title: result.tabCount > 1 ? 'Close tabs for page' : 'Close tab',
          subtitle: result.title,
          safety: 'destructive',
          shortcutHint: 'Alt+Enter',
          target: { kind: 'node', nodeId: result.nodeId, treeId: result.treeId },
        });
      }
    }
    return actions.slice(0, 4);
  }

  return [
    {
      actionId: 'open-tree',
      title: 'Open tree',
      subtitle: result.treeName,
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'tree', treeId: result.treeId },
    },
    {
      actionId: 'export-tree',
      title: 'Export tree',
      subtitle: result.treeName,
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'tree', treeId: result.treeId },
    },
    {
      actionId: 'delete-archived-tree',
      title: 'Delete archived tree',
      subtitle: result.treeName,
      safety: 'destructive',
      shortcutHint: 'Alt+Enter',
      target: { kind: 'tree', treeId: result.treeId },
    },
  ];
}

function buildScopedTreeActions(treeDoc: SpotlightLiveTreeDoc): ActionSeed[] {
  return [
    {
      actionId: 'open-tree',
      title: 'Open tree',
      subtitle: treeDoc.treeName,
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'tree', treeId: treeDoc.treeId },
    },
    {
      actionId: 'export-tree',
      title: 'Export tree',
      subtitle: treeDoc.treeName,
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'tree', treeId: treeDoc.treeId },
    },
    {
      actionId: 'delete-archived-tree',
      title: 'Delete archived tree',
      subtitle: treeDoc.treeName,
      safety: 'destructive',
      shortcutHint: 'Alt+Enter',
      target: { kind: 'tree', treeId: treeDoc.treeId },
    },
  ];
}

function buildExternalActions(query: string): ActionSeed[] {
  const normalizedQuery = normalizeSpotlightSearchQuery(query);
  if (!normalizedQuery) return [];

  const actions: ActionSeed[] = [];
  const normalizedUrl = normalizeSpotlightUrlCandidate(normalizedQuery);
  if (normalizedUrl) {
    actions.push({
      actionId: 'open-url',
      title: 'Open URL',
      subtitle: normalizedUrl,
      safety: 'safe',
      shortcutHint: 'Enter',
      target: { kind: 'url', url: normalizedUrl },
    });
  }
  actions.push({
    actionId: 'search-default-engine',
    title: 'Search with default engine',
    subtitle: normalizedQuery,
    safety: 'safe',
    shortcutHint: 'Enter',
    target: { kind: 'search', query: normalizedQuery },
  });
  return actions;
}

type ActionSeed = {
  actionId: SpotlightActionId;
  title: string;
  subtitle: string;
  safety: SpotlightActionSafety;
  shortcutHint: 'Enter' | 'Alt+Enter';
  target?: SpotlightActionTarget;
};

function toActionResult(seed: ActionSeed): SpotlightActionResult {
  return {
    kind: 'action',
    key: `a:${seed.actionId}:${actionTargetKey(seed.actionId, seed.target) ?? 'global'}`,
    actionId: seed.actionId,
    title: seed.title,
    subtitle: seed.subtitle,
    safety: seed.safety,
    shortcutHint: seed.shortcutHint,
    ...(seed.target ? { target: seed.target } : {}),
  };
}

function actionTargetKey(actionId: SpotlightActionId, target?: SpotlightActionTarget): string | null {
  if (!target) return `a:${actionId}:global`;
  switch (target.kind) {
    case 'node':
      return `n:${target.treeId}:${target.nodeId}`;
    case 'tree':
      return `t:${target.treeId}`;
    case 'url':
      return `u:${target.url}`;
    case 'search':
      return `s:${target.query}`;
    case 'global':
    default:
      return `a:${actionId}:global`;
  }
}

function getEntityLabel(item: SpotlightNodeResult | SpotlightTreeResult): string {
  return item.kind === 'node' ? item.title : item.treeName;
}

function matchesClause(doc: SpotlightLiveDoc, terms: SpotlightToken[]): boolean {
  for (const term of terms) {
    if (term.raw === '|') continue;
    if (term.field) {
      const matched = matchesField(doc, term.field, term.value);
      if (term.negated ? matched : !matched) return false;
      continue;
    }
    const needle = term.value.toLowerCase();
    const matched = doc.haystack.includes(needle);
    if (term.negated ? matched : !matched) return false;
  }
  return true;
}

function matchesField(
  doc: SpotlightLiveDoc,
  field: SpotlightToken['field'],
  value: string,
): boolean {
  if (!field) return false;
  switch (field) {
    case 'domain':
      return doc.domain === value || doc.domain.endsWith(`.${value}`);
    case 'tab':
      if (value === 'open') return doc.kind === 'node' && doc.group === 'open-tabs';
      if (value === 'closed') return doc.kind === 'tree' || doc.group !== 'open-tabs';
      return false;
    case 'tree':
      if (value === 'any') return true;
      if (value === 'current') return doc.kind === 'node' && doc.group !== 'other-trees';
      if (value === 'other') return doc.kind === 'tree' || doc.group === 'other-trees';
      return false;
    case 'group':
      return doc.group === value;
    case 'is':
      return value === 'current' && doc.kind === 'node' ? doc.isCurrent : false;
    default:
      return false;
  }
}

function extractQueryDomains(tokens: SpotlightToken[]): string[] {
  const values = new Set<string>();
  for (const token of tokens) {
    if (token.negated) continue;
    if (token.field === 'domain') {
      values.add(token.value.toLowerCase());
      continue;
    }
    if (token.field) continue;
    const maybeDomain = token.value.toLowerCase();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(maybeDomain)) {
      values.add(maybeDomain);
    }
  }
  return [...values];
}

function extractQueryUrls(tokens: SpotlightToken[]): string[] {
  const values = new Set<string>();
  for (const token of tokens) {
    if (token.negated || token.field) continue;
    const value = token.value.trim();
    if (!value) continue;
    try {
      values.add(new URL(value).toString());
    } catch {
      // ignore invalid URLs
    }
  }
  return [...values];
}

function collectHighlightNeedles(tokens: SpotlightToken[]): string[] {
  const set = new Set<string>();
  for (const token of tokens) {
    if (token.negated || token.field) continue;
    const value = token.value.toLowerCase().trim();
    if (!value || value.length < 2) continue;
    set.add(value);
  }
  return [...set];
}

function collectPositivePlainTokens(tokens: SpotlightToken[]): string[] {
  return tokens
    .filter((token) => !token.negated && !token.field && token.raw !== '|')
    .map((token) => token.value.trim().toLowerCase())
    .filter((token) => token.length >= 2)
    .slice(0, 5);
}

function findRanges(text: string, needles: string[]): Array<{ start: number; end: number }> {
  if (!text || needles.length === 0) return [];
  const lower = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  for (const needle of needles) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(needle, from);
      if (index === -1) break;
      ranges.push({ start: index, end: index + needle.length });
      from = index + Math.max(1, needle.length);
    }
  }
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [ranges[0]!];
  for (let i = 1; i < ranges.length; i += 1) {
    const current = ranges[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function toGroupBadge(group: SpotlightSuggestionGroup): 'Open' | 'Recent' | 'Tree' | 'Archived' {
  switch (group) {
    case 'open-tabs':
      return 'Open';
    case 'recently-closed':
      return 'Recent';
    case 'current-tree':
      return 'Tree';
    case 'other-trees':
    default:
      return 'Archived';
  }
}

function buildWhyChips(
  group: SpotlightSuggestionGroup,
  relation: SpotlightTreeRelation,
  breakdown: ReturnType<typeof scoreSpotlightCandidate> | null,
  tabCount: number,
  pinned: boolean,
): string[] {
  const chips: string[] = [];
  if (pinned) chips.push('pinned');
  if (breakdown?.exactPrefixTitleBoost) chips.push('prefix match');
  if (group === 'open-tabs') chips.push('open');
  if (group === 'recently-closed') chips.push('recent');
  if (group === 'current-tree') chips.push('current tree');
  if (group === 'other-trees') chips.push('other tree');
  if (
    relation === 'parent'
    || relation === 'child'
    || relation === 'sibling'
    || relation === 'same-branch'
  ) {
    chips.push('close in graph');
  }
  if ((breakdown?.selectionFrequencyBoost ?? 0) > 0.2) chips.push('picked often');
  if (tabCount > 1) chips.push(`${tabCount} tabs`);
  return chips;
}

function buildTreeWhyChips(breakdown: ReturnType<typeof scoreSpotlightCandidate>): string[] {
  const chips = ['archived'];
  if (breakdown.exactPrefixTitleBoost) chips.push('prefix match');
  if (breakdown.selectionFrequencyBoost > 0.2) chips.push('picked often');
  return chips;
}

export const spotlightService = new SpotlightService();
