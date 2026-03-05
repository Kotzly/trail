import MiniSearch from '../../shared/vendor/minisearch.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import { parseSpotlightQuery, type SpotlightToken } from '@shared/lib/spotlight/query-dsl.js';
import {
  scoreSpotlightCandidate,
  type SpotlightScoringCandidate,
} from '@shared/lib/spotlight/scoring.js';
import {
  type SpotlightSuggestionGroup,
} from '@shared/rpc/contracts.js';
import { treeStorage } from './tree-storage.js';
import { tabManager } from '../state/tab-manager.js';
import type { NodeId } from '@shared/types/ids.js';

const SESSION_TTL_MS = 120_000;
const MAX_RESULTS = 80;

type SessionDoc = {
  id: string;
  nodeId: NodeId;
  title: string;
  url: string;
  favicon?: string;
  group: SpotlightSuggestionGroup;
  recency: number;
  isCurrent: boolean;
  treeId?: string;
  treeName?: string;
  domain: string;
  tabCount: number;
  haystack: string;
};

type SpotlightSession = {
  id: LegacySpotlightSearchSessionId;
  index: MiniSearch;
  docsById: Map<string, SessionDoc>;
  docs: SessionDoc[];
  touchedAt: number;
};

export type LegacySpotlightSearchSessionId = string;

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
  highlights: {
    title: Array<{ start: number; end: number }>;
    url: Array<{ start: number; end: number }>;
  };
};

export type LegacySpotlightSearchResponse = {
  requestSeq: number;
  results: LegacySpotlightSearchResult[];
};

export type LegacySpotlightBootstrapData = {
  sessionId: LegacySpotlightSearchSessionId;
  results: LegacySpotlightSearchResult[];
  tree: ReturnType<typeof NavigationTreeMapper.toJSON>;
  currentNodeId: NodeId | null;
  openNodeIds: NodeId[];
  nodeRecency: Record<NodeId, number>;
  nodeTabCounts: Record<NodeId, number>;
};

export class SpotlightSearchService {
  private sessions = new Map<LegacySpotlightSearchSessionId, SpotlightSession>();

  async bootstrap(limit: number): Promise<LegacySpotlightBootstrapData> {
    this.pruneExpiredSessions();

    const tree = await treeStorage.getOrCreateTree();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const currentNodeId = tree.getCurrentId();
    const openNodeSet = new Set(tabManager.openNodes());
    const openNodeIds = Array.from(openNodeSet);

    const nodeRecency: Record<string, number> = {};
    const nodeTabCounts: Record<string, number> = {};

    for (const nodeId of openNodeIds) {
      const recency = tabManager.getNodeRecency(nodeId);
      if (recency > 0) nodeRecency[nodeId] = recency;
      nodeTabCounts[nodeId] = tabManager.tabCountForNode(nodeId);
    }

    const docs: SessionDoc[] = [];

    for (const node of tree.iter()) {
      const isOpen = openNodeSet.has(node.id);
      const recency = nodeRecency[node.id] ?? node.data.lastVisitedAt ?? node.timestamp ?? 0;
      const group: SpotlightSuggestionGroup = isOpen
        ? 'open-tabs'
        : recency > 0
        ? 'recently-closed'
        : 'current-tree';

      docs.push(this.makeDoc({
        id: `n:${node.id}`,
        nodeId: node.id,
        title: node.data.title || 'Untitled',
        url: node.data.url,
        ...(node.data.favicon ? { favicon: node.data.favicon as string } : {}),
        group,
        recency,
        isCurrent: node.id === currentNodeId,
        tabCount: nodeTabCounts[node.id] ?? 0,
      }));
    }

    const archived = await treeStorage.getArchivedSummaries();
    for (const entry of archived.slice(0, 20)) {
      const title = entry.label;
      const url = entry.rootUrl || '';
      docs.push(this.makeDoc({
        id: `t:${entry.id}`,
        nodeId: 0 as NodeId,
        title,
        url,
        ...(entry.rootFavicon ? { favicon: entry.rootFavicon as string } : {}),
        group: 'other-trees',
        recency: entry.savedAt ?? 0,
        isCurrent: false,
        treeId: entry.id,
        treeName: entry.label,
        tabCount: 0,
      }));
    }

    const session = this.createSession(docs);
    const results = this.searchInSession(session, '', limit, 0).results;

    return {
      sessionId: session.id,
      results,
      tree: treeJSON,
      currentNodeId,
      openNodeIds,
      nodeRecency: nodeRecency as Record<NodeId, number>,
      nodeTabCounts: nodeTabCounts as Record<NodeId, number>,
    };
  }

  search(
    sessionId: LegacySpotlightSearchSessionId,
    query: string,
    limit: number,
    requestSeq: number,
  ): LegacySpotlightSearchResponse {
    this.pruneExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SESSION_EXPIRED');
    }
    session.touchedAt = Date.now();
    return this.searchInSession(session, query, limit, requestSeq);
  }

  dispose(sessionId: LegacySpotlightSearchSessionId): void {
    this.sessions.delete(sessionId);
  }

  private createSession(docs: SessionDoc[]): SpotlightSession {
    const now = Date.now();
    const sessionId = `spotlight-session-${now}-${Math.random().toString(16).slice(2)}`;
    const index = new MiniSearch({
      fields: ['title', 'url', 'domain', 'treeName'],
      idField: 'id',
      storeFields: ['id'],
      searchOptions: {
        boost: { title: 4, domain: 3, treeName: 2, url: 1 },
        prefix: true,
        fuzzy: 0.2,
        combineWith: 'AND',
      },
    });

    index.addAll(docs);

    const session: SpotlightSession = {
      id: sessionId,
      index,
      docsById: new Map(docs.map((doc) => [doc.id, doc])),
      docs,
      touchedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private pruneExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.touchedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  private searchInSession(
    session: SpotlightSession,
    query: string,
    limit: number,
    requestSeq: number,
  ): LegacySpotlightSearchResponse {
    const ast = parseSpotlightQuery(query);
    const queryDomains = extractQueryDomains(ast.clauses.flatMap((clause) => clause.terms));
    const queryUrls = extractQueryUrls(ast.clauses.flatMap((clause) => clause.terms));

    const textScores = new Map<string, number>();

    for (const clause of ast.clauses) {
      const positiveTerms = clause.terms.filter((term) => !term.negated && !term.field);
      const clauseCandidates =
        positiveTerms.length > 0
          ? (session.index.search(
              positiveTerms.map((term) => term.value).join(' '),
              { combineWith: 'AND', prefix: true, fuzzy: 0.2 },
            ) as Array<{ id: string; score: number }>)
          : session.docs.map((doc) => ({ id: doc.id, score: 0 }));

      for (const candidate of clauseCandidates) {
        const doc = session.docsById.get(candidate.id);
        if (!doc) continue;
        if (!matchesClause(doc, clause.terms)) continue;
        const previous = textScores.get(doc.id);
        if (previous === undefined || candidate.score > previous) {
          textScores.set(doc.id, candidate.score);
        }
      }
    }

    const ranked: Array<{ item: LegacySpotlightSearchResult; recency: number }> = [];
    const now = Date.now();

    const needles = collectHighlightNeedles(ast.clauses.flatMap((clause) => clause.terms));

    for (const [docId, rawTextScore] of textScores.entries()) {
      const doc = session.docsById.get(docId);
      if (!doc) continue;

      const scoringCandidate: SpotlightScoringCandidate = {
        nodeId: doc.nodeId,
        url: doc.url,
        domain: doc.domain,
        group: doc.group,
        recency: doc.recency,
        isCurrent: doc.isCurrent,
        tabCount: doc.tabCount,
      };
      const breakdown = scoreSpotlightCandidate(
        scoringCandidate,
        {
          textScore: rawTextScore,
          queryDomains,
          queryUrls,
        },
        now,
      );

      ranked.push({
        item: {
          nodeId: doc.nodeId,
          title: doc.title,
          url: doc.url,
          ...(doc.favicon ? { favicon: doc.favicon } : {}),
          group: doc.group,
          recency: doc.recency,
          isCurrent: doc.isCurrent,
          ...(doc.treeId ? { treeId: doc.treeId } : {}),
          ...(doc.treeName ? { treeName: doc.treeName } : {}),
          score: breakdown.finalScore,
          groupBadge: toGroupBadge(doc.group),
          highlights: {
            title: findRanges(doc.title, needles),
            url: findRanges(doc.url, needles),
          },
        },
        recency: doc.recency,
      });
    }

    ranked.sort((a, b) => {
      if (b.item.score !== a.item.score) return b.item.score - a.item.score;
      if (b.recency !== a.recency) return b.recency - a.recency;
      if (a.item.nodeId !== b.item.nodeId) {
        return Number(a.item.nodeId) - Number(b.item.nodeId);
      }
      return a.item.title.localeCompare(b.item.title);
    });

    const capped = Math.max(1, Math.min(MAX_RESULTS, limit || MAX_RESULTS));

    return {
      requestSeq,
      results: ranked.slice(0, capped).map((entry) => entry.item),
    };
  }

  private makeDoc(input: {
    id: string;
    nodeId: NodeId;
    title: string;
    url: string;
    favicon?: string;
    group: SpotlightSuggestionGroup;
    recency: number;
    isCurrent: boolean;
    treeId?: string;
    treeName?: string;
    tabCount: number;
  }): SessionDoc {
    const domain = extractDomain(input.url);
    return {
      ...input,
      domain,
      haystack: `${input.title} ${input.url} ${domain} ${input.treeName ?? ''}`.toLowerCase(),
    };
  }
}

function matchesClause(doc: SessionDoc, terms: SpotlightToken[]): boolean {
  for (const term of terms) {
    if (term.raw === '|') continue;

    if (term.field) {
      const matched = matchesField(doc, term.field, term.value);
      if (term.negated ? matched : !matched) {
        return false;
      }
      continue;
    }

    const source = doc.haystack;
    const needle = term.value.toLowerCase();
    const matched = source.includes(needle);
    if (term.negated ? matched : !matched) {
      return false;
    }
  }
  return true;
}

function matchesField(doc: SessionDoc, field: SpotlightToken['field'], value: string): boolean {
  if (!field) return false;

  switch (field) {
    case 'domain': {
      const normalized = doc.domain.toLowerCase();
      return normalized === value || normalized.endsWith(`.${value}`);
    }
    case 'tab': {
      if (value === 'open') return doc.group === 'open-tabs';
      if (value === 'closed') return doc.group !== 'open-tabs';
      return false;
    }
    case 'tree': {
      if (value === 'any') return true;
      if (value === 'current') return doc.group !== 'other-trees';
      if (value === 'other') return doc.group === 'other-trees';
      return false;
    }
    case 'group':
      return doc.group === value;
    case 'is':
      return value === 'current' ? doc.isCurrent : false;
    default:
      return false;
  }
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
      return 'Archived';
  }
}

function extractDomain(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
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
      // ignore
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

  if (ranges.length === 0) return ranges;

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [ranges[0]!];

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

export const spotlightSearchService = new SpotlightSearchService();
