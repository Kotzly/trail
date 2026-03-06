import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import {
  bootstrapSpotlight,
  disposeSpotlightSession,
  executeSpotlightAction,
  exportTree,
  getSpotlightTreePreview,
  searchSpotlight,
} from './rpc.js';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import {
  applySpotlightHint,
  buildSpotlightHints,
  computeGhostSuffix,
  shouldApplyHintOnTab,
} from './SpotlightHintRow.js';
import { isDestructiveAction } from './SpotlightFooter.js';
import { SpotlightHelp } from './SpotlightHelp.js';
import type {
  SpotlightActionId,
  SpotlightBootstrapData,
  SpotlightGraphPreviewData,
  SpotlightSearchResult,
  SpotlightSearchSessionId,
  SpotlightSection,
} from './types.js';
import { highlightText } from './highlight.js';
import { LRUMap } from './lru-map.js';
import type { NodeId } from '@shared/types/ids.js';

type SpotlightRootProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

type SpotlightNodeTarget = {
  treeId: string;
  nodeId: NodeId;
};

const SEARCH_LIMIT = 80;
const SEARCH_DEBOUNCE_MS = 80;

export function SpotlightRoot({ onRegisterToggle }: SpotlightRootProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [bootstrapData, setBootstrapData] = useState<SpotlightBootstrapData | null>(null);
  const [sessionId, setSessionId] = useState<SpotlightSearchSessionId | null>(null);
  const [sections, setSections] = useState<SpotlightSection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFocusPane, setSelectedFocusPane] = useState<'list' | 'graph'>('list');
  const [helpOpen, setHelpOpen] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [hoveredGraphTarget, setHoveredGraphTarget] = useState<SpotlightNodeTarget | null>(null);
  const [graphPreviewData, setGraphPreviewData] = useState<SpotlightGraphPreviewData | null>(null);
  const [graphPreviewLoading, setGraphPreviewLoading] = useState(false);
  const [selectionIntentId, setSelectionIntentId] = useState(0);
  const [drilldownScope, setDrilldownScope] = useState<{ treeId: string; treeName: string } | null>(null);
  const [predrilldownQuery, setPredrilldownQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const requestSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewCacheRef = useRef(new LRUMap<string, SpotlightGraphPreviewData>(20));
  const lastCommittedKeyRef = useRef<string | null>(null);
  const lastKeyEventRef = useRef<{ altKey: boolean }>({ altKey: false });

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setHelpOpen(false);
    setStatusText(null);
    setDrilldownScope(null);
    setPredrilldownQuery('');
  }, []);

  useEffect(() => {
    onRegisterToggle(toggle);
  }, [onRegisterToggle, toggle]);

  useEffect(() => {
    if (isOpen) setHasBeenOpened(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    bootstrapSpotlight(SEARCH_LIMIT)
      .then((data) => {
        if (cancelled) return;
        previewCacheRef.current.clear();
        setBootstrapData(data);
        setSessionId(data.sessionId);
        setSections(data.sections);
        setGraphPreviewData(null);
        setGraphPreviewLoading(false);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to bootstrap spotlight v3:', error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !sessionId) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      requestSeqRef.current += 1;
      const requestSeq = requestSeqRef.current;
      setLoading(true);

      searchSpotlight(sessionId, query, SEARCH_LIMIT, requestSeq, drilldownScope?.treeId)
        .then((response) => {
          if (cancelled) return;
          if (response.requestSeq !== requestSeqRef.current) return;
          setSections(response.sections);
          setLoading(false);
          prefetchPreviews(response.sections, activeTreeId, previewCacheRef.current);
        })
        .catch(async (error) => {
          if (cancelled) return;
          if ((error as Error).message === 'SESSION_EXPIRED') {
            try {
              const data = await bootstrapSpotlight(SEARCH_LIMIT);
              if (cancelled) return;
              previewCacheRef.current.clear();
              setBootstrapData(data);
              setSessionId(data.sessionId);
              setSections(data.sections);
              setLoading(false);
              return;
            } catch (retryError) {
              console.error('Failed to recover spotlight v3 session:', retryError);
              setLoading(false);
              return;
            }
          }
          console.error('Failed to search spotlight v3:', error);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, query, sessionId, drilldownScope]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setQuery('');
    requestSeqRef.current += 1;
    setSelectedKey(null);
    setHoveredGraphTarget(null);
    setGraphPreviewData(null);
    setGraphPreviewLoading(false);
    setDrilldownScope(null);
    setPredrilldownQuery('');

    const activeSession = sessionId;
    setSessionId(null);
    if (activeSession) {
      void disposeSpotlightSession(activeSession).catch(() => undefined);
    }
  }, [isOpen, sessionId]);

  useEffect(() => {
    return () => {
      if (!sessionId) return;
      void disposeSpotlightSession(sessionId).catch(() => undefined);
    };
  }, [sessionId]);

  const activeTreeId = bootstrapData?.activeTreeId ?? null;

  const flatItems = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections],
  );
  const itemByKey = useMemo(
    () => new Map(flatItems.map((item) => [item.key, item])),
    [flatItems],
  );

  const hoveredGraphKey = useMemo(() => {
    if (!hoveredGraphTarget) return null;
    return (
      flatItems.find((item) => {
        const target = resolveNodeTarget(item);
        return (
          target?.treeId === hoveredGraphTarget.treeId
          && target.nodeId === hoveredGraphTarget.nodeId
        );
      })?.key ?? null
    );
  }, [flatItems, hoveredGraphTarget]);

  const selectedItem = selectedKey ? itemByKey.get(selectedKey) ?? null : null;
  const hoveredGraphItem = hoveredGraphKey ? itemByKey.get(hoveredGraphKey) ?? null : null;
  const effectiveItem = hoveredGraphItem ?? selectedItem;
  const activeRowKey = hoveredGraphKey ?? selectedKey;

  useEffect(() => {
    if (selectedKey === lastCommittedKeyRef.current) return;
    lastCommittedKeyRef.current = selectedKey;
    setSelectionIntentId((current) => current + 1);
  }, [selectedKey]);

  const hintCandidates = useMemo(() => buildSpotlightHints(query), [query]);
  const activeHint = hintCandidates[0] ?? null;
  const ghostSuffix = useMemo(() => computeGhostSuffix(query, activeHint), [query, activeHint]);

  const previewTreeId = useMemo(() => {
    if (drilldownScope) return drilldownScope.treeId;
    const candidate = hoveredGraphTarget?.treeId ?? resolvePreviewTreeId(effectiveItem);
    if (!candidate || !activeTreeId || candidate === activeTreeId) {
      return null;
    }
    return candidate;
  }, [activeTreeId, drilldownScope, effectiveItem, hoveredGraphTarget]);

  useEffect(() => {
    let cancelled = false;

    if (!previewTreeId) {
      setGraphPreviewData(null);
      setGraphPreviewLoading(false);
      return;
    }

    const cached = previewCacheRef.current.get(previewTreeId) ?? null;
    if (cached) {
      setGraphPreviewData(cached);
      setGraphPreviewLoading(false);
      return;
    }

    setGraphPreviewLoading(true);
    void getSpotlightTreePreview(previewTreeId)
      .then((preview) => {
        if (cancelled) return;
        if (preview) {
          previewCacheRef.current.set(previewTreeId, preview);
          setGraphPreviewData(preview);
        } else {
          setGraphPreviewData(null);
        }
      })
      .catch((error) => {
        console.error('Failed to load spotlight graph preview:', error);
        if (!cancelled) {
          setGraphPreviewData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGraphPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewTreeId]);

  const selectedNodeTarget = resolveNodeTarget(selectedItem);
  const highlightNodeTarget = hoveredGraphTarget ?? resolveNodeTarget(selectedItem);
  const currentGraphTreeId = previewTreeId ?? activeTreeId;
  const graphSelectedNodeId =
    currentGraphTreeId && selectedNodeTarget?.treeId === currentGraphTreeId
      ? selectedNodeTarget.nodeId
      : null;
  const graphHighlightNodeId =
    currentGraphTreeId && highlightNodeTarget?.treeId === currentGraphTreeId
      ? highlightNodeTarget.nodeId
      : null;

  const handleApplyHint = useCallback((hint: string) => {
    setQuery((current) => applySpotlightHint(current, hint));
    setStatusText(null);
  }, []);

  const exitDrilldown = useCallback(() => {
    const restored = predrilldownQuery;
    setDrilldownScope(null);
    setPredrilldownQuery('');
    setQuery(restored);
    setGraphPreviewData(null);
  }, [predrilldownQuery]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleExecuteAction = useCallback(
    async (
      actionId: SpotlightActionId,
      target: Parameters<typeof executeSpotlightAction>[1],
      nextStatusText: string,
    ) => {
      try {
        const response = await executeSpotlightAction(actionId, target, query);
        if (response.statusText) {
          setStatusText(response.statusText);
        } else {
          setStatusText(nextStatusText);
        }
        if (response.closeSpotlight) close();
      } catch (error) {
        console.error(`Failed to execute spotlight action ${actionId}:`, error);
        setStatusText('Action failed');
      }
    },
    [close, query],
  );

  const handleActivate = useCallback(async (item: SpotlightSearchResult, event?: { allowDestructive?: boolean }) => {
    setStatusText(null);

    if (item.kind === 'action') {
      if (item.actionId === 'show-command-help') {
        setHelpOpen(true);
        return;
      }
      if (isDestructiveAction(item) && !event?.allowDestructive) {
        setStatusText('Use Alt+Enter for destructive actions');
        return;
      }
      if (item.actionId === 'copy-url') {
        const targetItem = resolveCopyUrlItem(item, flatItems);
        if (targetItem) {
          try {
            await navigator.clipboard.writeText(targetItem.url);
            setStatusText('URL copied');
            close();
          } catch (error) {
            console.error('Failed to copy URL:', error);
            setStatusText('Clipboard unavailable');
          }
        }
        return;
      }
      if (item.actionId === 'export-tree') {
        try {
          const treeId = item.target?.kind === 'tree' ? item.target.treeId : undefined;
          const bundle = await exportTree(treeId);
          downloadBundle(bundle);
          setStatusText('Tree exported');
          close();
        } catch (error) {
          console.error('Failed to export tree:', error);
          setStatusText('Export failed');
        }
        return;
      }

      await handleExecuteAction(item.actionId, item.target, 'Done');
      return;
    }

    if (item.kind === 'tree') {
      setPredrilldownQuery(query);
      setDrilldownScope({ treeId: item.treeId, treeName: item.treeName });
      setQuery('');

      const cached = previewCacheRef.current.get(item.treeId);
      if (cached) {
        setGraphPreviewData(cached);
      } else {
        setGraphPreviewLoading(true);
        void getSpotlightTreePreview(item.treeId).then((preview) => {
          if (preview) {
            previewCacheRef.current.set(item.treeId, preview);
            setGraphPreviewData(preview);
          }
          setGraphPreviewLoading(false);
        });
      }
      return;
    }

    const actionId: SpotlightActionId =
      activeTreeId && item.treeId !== activeTreeId ? 'open-node-in-tree' : 'open';
    await handleExecuteAction(
      actionId,
      { kind: 'node', nodeId: item.nodeId, treeId: item.treeId },
      actionId === 'open-node-in-tree' ? 'Opened in tree' : 'Opened',
    );
  }, [activeTreeId, close, flatItems, handleExecuteAction, query]);

  const handleKeyDownCapture = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter': {
        if (hoveredGraphItem) {
          event.preventDefault();
          event.stopPropagation();
          void handleActivate(hoveredGraphItem, { allowDestructive: event.altKey });
          return;
        }
        lastKeyEventRef.current = { altKey: event.altKey };
        return;
      }
      case 'Tab':
        if (shouldApplyHintOnTab(query, hintCandidates) && activeHint) {
          event.preventDefault();
          event.stopPropagation();
          handleApplyHint(activeHint);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setSelectedFocusPane((current) => current === 'list' ? 'graph' : 'list');
        return;
      case 'Backspace': {
        if (drilldownScope && query === '') {
          event.preventDefault();
          event.stopPropagation();
          exitDrilldown();
          return;
        }
        const isMac = navigator.platform.includes('Mac');
        const clearCombo = isMac ? event.metaKey : event.ctrlKey;
        if (clearCombo) {
          event.preventDefault();
          event.stopPropagation();
          setQuery('');
        }
        return;
      }
      case '?':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          setHelpOpen((current) => !current);
        }
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (helpOpen) {
          setHelpOpen(false);
        } else if (drilldownScope) {
          exitDrilldown();
        } else {
          close();
        }
        return;
      default:
        return;
    }
  }, [activeHint, close, drilldownScope, exitDrilldown, handleActivate, handleApplyHint, helpOpen, hintCandidates, hoveredGraphItem, query]);

  if (!hasBeenOpened) return null;

  return (
    <div
      className="spotlight-backdrop"
      style={{ pointerEvents: isOpen ? 'auto' : 'none', opacity: isOpen ? 1 : 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <Command
        shouldFilter={false}
        value={selectedKey ?? ''}
        onValueChange={(value) => {
          setSelectedKey(value || null);
          setHoveredGraphTarget(null);
        }}
        loop
        className="spotlight-container spotlight-container--v3"
      >
        <div className="spotlight-search spotlight-search--v3">
          <div className="spotlight-input-wrap">
            <Command.Input
              ref={inputRef}
              className="spotlight-search-input"
              placeholder={drilldownScope ? `Search in ${drilldownScope.treeName}...` : 'Search pages or type > for commands'}
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setStatusText(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {ghostSuffix && (
              <span className="spotlight-ghost" aria-hidden="true">
                <span className="spotlight-ghost-mirror">{query}</span>
                <span className="spotlight-ghost-suffix">{ghostSuffix}</span>
              </span>
            )}
          </div>
        </div>

        {drilldownScope && (
          <div className="spotlight-breadcrumb">
            <button
              type="button"
              className="spotlight-breadcrumb-back"
              onClick={exitDrilldown}
              tabIndex={-1}
            >
              ←
            </button>
            <span className="spotlight-breadcrumb-label">{drilldownScope.treeName}</span>
          </div>
        )}

        <div className="spotlight-panels spotlight-panels--v3">
          <div className="spotlight-left spotlight-left--v3">
            {helpOpen ? (
              <SpotlightHelp open />
            ) : loading ? (
              <div className="spotlight-empty">Loading...</div>
            ) : sections.length === 0 ? (
              <Command.Empty className="spotlight-empty">No results found</Command.Empty>
            ) : (
              <Command.List className="spotlight-sections">
                {sections.map((section, i) => {
                  const collapsed = collapsedSections.has(section.id);
                  return (
                    <Command.Group
                      key={section.id}
                      heading={
                        <button
                          type="button"
                          className="spotlight-section-toggle"
                          onClick={() => toggleSection(section.id)}
                          tabIndex={-1}
                        >
                          <span className="spotlight-section-chevron" data-collapsed={collapsed} />
                          {section.title}
                          <span className="spotlight-section-count">{section.items.length}</span>
                        </button>
                      }
                      className="spotlight-section"
                      data-first={i === 0}
                      data-collapsed={collapsed}
                    >
                      {!collapsed && section.items.map((item) => (
                        <Command.Item
                          key={item.key}
                          value={item.key}
                          className={`spotlight-row spotlight-row--${item.kind}`}
                          data-destructive={item.kind === 'action' && item.safety === 'destructive'}
                          onSelect={() => {
                            void handleActivate(item, {
                              allowDestructive: lastKeyEventRef.current.altKey,
                            });
                            lastKeyEventRef.current = { altKey: false };
                          }}
                        >
                          <div className="spotlight-row-main">
                            <div className="spotlight-row-title">{renderItemTitle(item)}</div>
                            <div className="spotlight-row-subtitle">{renderItemSubtitle(item)}</div>
                          </div>
                          <div className="spotlight-row-meta">{getItemMeta(item)}</div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </Command.List>
            )}
          </div>

          <div className="spotlight-right spotlight-right--v3" data-focus={selectedFocusPane}>
            <SpotlightGraphFrame
              activeTreeId={activeTreeId}
              previewData={graphPreviewData}
              selectedNodeId={graphSelectedNodeId}
              highlightNodeId={graphHighlightNodeId}
              selectionIntentId={selectionIntentId}
              onNavigate={(treeId, nodeId) => {
                const actionId: SpotlightActionId =
                  activeTreeId && treeId !== activeTreeId ? 'open-node-in-tree' : 'open';
                void handleExecuteAction(
                  actionId,
                  { kind: 'node', nodeId, treeId },
                  actionId === 'open-node-in-tree' ? 'Opened in tree' : 'Opened',
                );
              }}
              onHoverNode={(treeId, nodeId) => {
                setHoveredGraphTarget(nodeId === null ? null : { treeId, nodeId });
              }}
            />
            {graphPreviewLoading && <div className="spotlight-graph-loading">Loading tree preview...</div>}
            {previewTreeId && !graphPreviewLoading && !graphPreviewData && (
              <div className="spotlight-empty spotlight-graph-fallback">Preview unavailable</div>
            )}
          </div>
        </div>

        {statusText && (
          <div className="spotlight-status-bar">
            <span className="spotlight-status">{statusText}</span>
          </div>
        )}
      </Command>
    </div>
  );
}

function renderItemTitle(item: SpotlightSearchResult): ReactNode {
  if (item.kind === 'node') return highlightText(item.title, item.highlights.title);
  if (item.kind === 'tree') return highlightText(item.treeName, item.highlights.title);
  return item.title;
}

function renderItemSubtitle(item: SpotlightSearchResult): ReactNode {
  if (item.kind === 'node') return highlightText(item.url, item.highlights.url);
  if (item.kind === 'tree') {
    const text = item.rootUrl || 'Archived tree';
    return item.rootUrl ? highlightText(text, item.highlights.url) : text;
  }
  return item.subtitle;
}

function getItemMeta(item: SpotlightSearchResult): string {
  if (item.kind === 'node') {
    if (item.group === 'other-trees') return item.treeName;
    if (item.pinned) return 'Pinned';
    return item.groupBadge;
  }
  if (item.kind === 'tree') return item.groupBadge;
  return item.shortcutHint;
}

function resolvePreviewTreeId(item: SpotlightSearchResult | null): string | null {
  if (!item) return null;
  if (item.kind === 'node') return item.treeId;
  if (item.kind === 'tree') return item.treeId;
  if (item.target?.kind === 'node' || item.target?.kind === 'tree') {
    return item.target.treeId;
  }
  return null;
}

function resolveNodeTarget(item: SpotlightSearchResult | null): SpotlightNodeTarget | null {
  if (!item) return null;
  if (item.kind === 'node') {
    return { treeId: item.treeId, nodeId: item.nodeId };
  }
  if (item.kind === 'action' && item.target?.kind === 'node') {
    return { treeId: item.target.treeId, nodeId: item.target.nodeId };
  }
  return null;
}

function resolveCopyUrlItem(
  action: Extract<SpotlightSearchResult, { kind: 'action' }>,
  items: SpotlightSearchResult[],
): Extract<SpotlightSearchResult, { kind: 'node' }> | null {
  const target = action.target;
  if (!target || target.kind !== 'node') return null;
  const item = items.find((candidate) => {
    return (
      candidate.kind === 'node'
      && candidate.nodeId === target.nodeId
      && candidate.treeId === target.treeId
    );
  });
  return item?.kind === 'node' ? item : null;
}

function downloadBundle(bundle: import('@shared/types/export.js').TrailExportBundle): void {
  const label = bundle.source.treeLabel ?? 'trail';
  const json = JSON.stringify(bundle);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFilename(label)}.trail.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'trail';
}

const PREFETCH_LIMIT = 3;

function prefetchPreviews(
  sections: SpotlightSection[],
  activeTreeId: string | null,
  cache: LRUMap<string, SpotlightGraphPreviewData>,
): void {
  const seen = new Set<string>();
  const treeIds: string[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      if (treeIds.length >= PREFETCH_LIMIT) return;
      const treeId = item.kind === 'node' ? item.treeId : item.kind === 'tree' ? item.treeId : null;
      if (!treeId || treeId === activeTreeId || cache.has(treeId) || seen.has(treeId)) continue;
      seen.add(treeId);
      treeIds.push(treeId);
    }
  }

  for (const treeId of treeIds) {
    void getSpotlightTreePreview(treeId).then((preview) => {
      if (preview) cache.set(treeId, preview);
    }).catch(() => undefined);
  }
}
