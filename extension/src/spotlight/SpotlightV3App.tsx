import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { NodeId } from '@shared/types/ids.js';

type SpotlightV3AppProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

type SpotlightSelectableRow = {
  key: string;
  sectionId: SpotlightSection['id'];
  item: SpotlightSearchResult;
  rowIndex: number;
};

type SpotlightNodeTarget = {
  treeId: string;
  nodeId: NodeId;
};

const SEARCH_LIMIT = 80;
const SEARCH_DEBOUNCE_MS = 80;

export function SpotlightV3App({ onRegisterToggle }: SpotlightV3AppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [bootstrapData, setBootstrapData] = useState<SpotlightBootstrapData | null>(null);
  const [sessionId, setSessionId] = useState<SpotlightSearchSessionId | null>(null);
  const [sections, setSections] = useState<SpotlightSection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredListKey, setHoveredListKey] = useState<string | null>(null);
  const [selectedFocusPane, setSelectedFocusPane] = useState<'list' | 'graph'>('list');
  const [helpOpen, setHelpOpen] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [hoveredGraphTarget, setHoveredGraphTarget] = useState<SpotlightNodeTarget | null>(null);
  const [graphPreviewData, setGraphPreviewData] = useState<SpotlightGraphPreviewData | null>(null);
  const [graphPreviewLoading, setGraphPreviewLoading] = useState(false);
  const [selectionIntentId, setSelectionIntentId] = useState(0);

  const requestSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewCacheRef = useRef<Map<string, SpotlightGraphPreviewData>>(new Map());
  const lastCommittedKeyRef = useRef<string | null>(null);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setHelpOpen(false);
    setStatusText(null);
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

      searchSpotlight(sessionId, query, SEARCH_LIMIT, requestSeq)
        .then((response) => {
          if (cancelled) return;
          if (response.requestSeq !== requestSeqRef.current) return;
          setSections(response.sections);
          setLoading(false);
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
  }, [isOpen, query, sessionId]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setQuery('');
    requestSeqRef.current += 1;
    setSelectedKey(null);
    setHoveredListKey(null);
    setHoveredGraphTarget(null);
    setGraphPreviewData(null);
    setGraphPreviewLoading(false);

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
  const flatRows = useMemo(() => flattenSections(sections), [sections]);
  const itemByKey = useMemo(() => new Map(flatRows.map((row) => [row.key, row.item])), [flatRows]);

  const hoveredGraphKey = useMemo(() => {
    if (!hoveredGraphTarget) return null;
    return (
      flatRows.find((row) => {
        const target = resolveNodeTarget(row.item);
        return (
          target?.treeId === hoveredGraphTarget.treeId
          && target.nodeId === hoveredGraphTarget.nodeId
        );
      })?.key ?? null
    );
  }, [flatRows, hoveredGraphTarget]);

  const selectedItem = selectedKey ? itemByKey.get(selectedKey) ?? null : null;
  const hoveredListItem = hoveredListKey ? itemByKey.get(hoveredListKey) ?? null : null;
  const hoveredGraphItem = hoveredGraphKey ? itemByKey.get(hoveredGraphKey) ?? null : null;
  const effectiveItem = hoveredGraphItem ?? hoveredListItem ?? selectedItem;
  const activeRowKey = hoveredGraphKey ?? hoveredListKey ?? selectedKey;

  useEffect(() => {
    if (flatRows.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (selectedKey && flatRows.some((row) => row.key === selectedKey)) {
      return;
    }
    setSelectedKey(flatRows[0]?.key ?? null);
  }, [flatRows, selectedKey]);

  useEffect(() => {
    if (selectedKey === lastCommittedKeyRef.current) return;
    lastCommittedKeyRef.current = selectedKey;
    setSelectionIntentId((current) => current + 1);
  }, [selectedKey]);

  const hintCandidates = useMemo(() => buildSpotlightHints(query), [query]);
  const activeHint = hintCandidates[0] ?? null;
  const ghostSuffix = useMemo(() => computeGhostSuffix(query, activeHint), [query, activeHint]);

  const previewTreeId = useMemo(() => {
    const candidate = hoveredGraphTarget?.treeId ?? resolvePreviewTreeId(effectiveItem);
    if (!candidate || !activeTreeId || candidate === activeTreeId) {
      return null;
    }
    return candidate;
  }, [activeTreeId, effectiveItem, hoveredGraphTarget]);

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
  const highlightNodeTarget = hoveredGraphTarget ?? resolveNodeTarget(hoveredListItem ?? selectedItem);
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
        const targetItem = resolveCopyUrlItem(item, flatRows);
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
      await handleExecuteAction(
        'open-tree',
        { kind: 'tree', treeId: item.treeId },
        'Tree opened',
      );
      return;
    }

    const actionId: SpotlightActionId =
      activeTreeId && item.treeId !== activeTreeId ? 'open-node-in-tree' : 'open';
    await handleExecuteAction(
      actionId,
      { kind: 'node', nodeId: item.nodeId, treeId: item.treeId },
      actionId === 'open-node-in-tree' ? 'Opened in tree' : 'Opened',
    );
  }, [activeTreeId, close, flatRows, handleExecuteAction]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const rows = flatRows;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHoveredListKey(null);
        setHoveredGraphTarget(null);
        setSelectedKey((current) => nextSelection(rows, current, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setHoveredListKey(null);
        setHoveredGraphTarget(null);
        setSelectedKey((current) => nextSelection(rows, current, -1));
        return;
      case 'Tab':
        if (shouldApplyHintOnTab(query, hintCandidates) && activeHint) {
          event.preventDefault();
          handleApplyHint(activeHint);
          return;
        }
        event.preventDefault();
        setSelectedFocusPane((current) => current === 'list' ? 'graph' : 'list');
        return;
      case 'Enter': {
        event.preventDefault();
        if (!effectiveItem) return;
        void handleActivate(effectiveItem, { allowDestructive: event.altKey });
        return;
      }
      case 'Backspace': {
        const isMac = navigator.platform.includes('Mac');
        const clearCombo = isMac ? event.metaKey : event.ctrlKey;
        if (clearCombo) {
          event.preventDefault();
          setQuery('');
        }
        return;
      }
      case '?':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          setHelpOpen((current) => !current);
        }
        return;
      case 'Escape':
        event.preventDefault();
        if (helpOpen) {
          setHelpOpen(false);
        } else {
          close();
        }
        return;
      default:
        return;
    }
  }, [activeHint, close, effectiveItem, flatRows, handleActivate, handleApplyHint, helpOpen, hintCandidates, query]);

  if (!hasBeenOpened) return null;

  return (
    <div
      className="spotlight-backdrop"
      style={{ pointerEvents: isOpen ? 'auto' : 'none', opacity: isOpen ? 1 : 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="spotlight-container spotlight-container--v3">
        <div className="spotlight-search spotlight-search--v3">
          <div className="spotlight-input-wrap">
            <input
              ref={inputRef}
              className="spotlight-search-input"
              type="text"
              placeholder="Search pages or type > for commands"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
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

        <div className="spotlight-panels spotlight-panels--v3">
          <div className="spotlight-left spotlight-left--v3">
            {helpOpen ? (
              <SpotlightHelp open />
            ) : loading ? (
              <div className="spotlight-empty">Loading...</div>
            ) : (
              <SpotlightSectionList
                sections={sections}
                selectedKey={activeRowKey}
                onHoverKey={(key) => {
                  setHoveredGraphTarget(null);
                  setHoveredListKey(key);
                }}
                onHoverEnd={() => setHoveredListKey(null)}
                onActivate={handleActivate}
              />
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
      </div>
    </div>
  );
}

function SpotlightSectionList({
  sections,
  selectedKey,
  onHoverKey,
  onHoverEnd,
  onActivate,
}: {
  sections: SpotlightSection[];
  selectedKey: string | null;
  onHoverKey: (key: string) => void;
  onHoverEnd: () => void;
  onActivate: (item: SpotlightSearchResult) => void;
}) {
  if (sections.length === 0) {
    return <div className="spotlight-empty">No results found</div>;
  }

  return (
    <div className="spotlight-sections" onMouseLeave={onHoverEnd}>
      {sections.map((section, sectionIndex) => (
        <div key={section.id} className="spotlight-section" data-first={sectionIndex === 0}>
          <div className="spotlight-section-title">{section.title}</div>
          {section.items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`spotlight-row spotlight-row--${item.kind}`}
              data-selected={item.key === selectedKey}
              data-destructive={item.kind === 'action' && item.safety === 'destructive'}
              onMouseEnter={() => onHoverKey(item.key)}
              onClick={() => onActivate(item)}
            >
              <div className="spotlight-row-main">
                <div className="spotlight-row-title">{getItemTitle(item)}</div>
                <div className="spotlight-row-subtitle">{getItemSubtitle(item)}</div>
              </div>
              <div className="spotlight-row-meta">{getItemMeta(item)}</div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function flattenSections(sections: SpotlightSection[]): SpotlightSelectableRow[] {
  const rows: SpotlightSelectableRow[] = [];
  let rowIndex = 0;
  for (const section of sections) {
    for (const item of section.items) {
      rows.push({ key: item.key, sectionId: section.id, item, rowIndex });
      rowIndex += 1;
    }
  }
  return rows;
}

function nextSelection(
  rows: SpotlightSelectableRow[],
  current: string | null,
  delta: 1 | -1,
): string | null {
  if (rows.length === 0) return null;
  const currentIndex = current ? rows.findIndex((row) => row.key === current) : -1;
  const base = currentIndex === -1 ? (delta === 1 ? -1 : 0) : currentIndex;
  const nextIndex = (base + delta + rows.length) % rows.length;
  return rows[nextIndex]?.key ?? null;
}

function getItemTitle(item: SpotlightSearchResult): string {
  if (item.kind === 'node') return item.title;
  if (item.kind === 'tree') return item.treeName;
  return item.title;
}

function getItemSubtitle(item: SpotlightSearchResult): string {
  if (item.kind === 'node') return item.url;
  if (item.kind === 'tree') return item.rootUrl || 'Archived tree';
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
  rows: SpotlightSelectableRow[],
): Extract<SpotlightSearchResult, { kind: 'node' }> | null {
  const target = action.target;
  if (!target || target.kind !== 'node') return null;
  const item = rows.find((row) => {
    return (
      row.item.kind === 'node'
      && row.item.nodeId === target.nodeId
      && row.item.treeId === target.treeId
    );
  })?.item;
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
