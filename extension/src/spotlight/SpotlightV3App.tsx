import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bootstrapSpotlight,
  disposeSpotlightSession,
  executeSpotlightAction,
  exportTree,
  searchSpotlight,
} from './rpc.js';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import { SpotlightHintRow, applySpotlightHint, buildSpotlightHints, shouldApplyHintOnTab } from './SpotlightHintRow.js';
import { SpotlightFooter, isDestructiveAction } from './SpotlightFooter.js';
import { SpotlightHelp } from './SpotlightHelp.js';
import { SpotlightContextCard } from './SpotlightContextCard.js';
import type {
  SpotlightActionResult,
  SpotlightBootstrapData,
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

const SEARCH_LIMIT = 80;
const SEARCH_DEBOUNCE_MS = 80;

export function SpotlightV3App({ onRegisterToggle }: SpotlightV3AppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [, setBootstrapData] = useState<SpotlightBootstrapData | null>(null);
  const [sessionId, setSessionId] = useState<SpotlightSearchSessionId | null>(null);
  const [sections, setSections] = useState<SpotlightSection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFocusPane, setSelectedFocusPane] = useState<'list' | 'graph'>('list');
  const [helpOpen, setHelpOpen] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [hoveredGraphNodeId, setHoveredGraphNodeId] = useState<NodeId | null>(null);
  const requestSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
        setBootstrapData(data);
        setSessionId(data.sessionId);
        setSections(data.sections);
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
    setHoveredGraphNodeId(null);

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

  const flatRows = useMemo(() => flattenSections(sections), [sections]);
  const itemByKey = useMemo(() => new Map(flatRows.map((row) => [row.key, row.item])), [flatRows]);
  const hoveredKey = useMemo(() => {
    if (hoveredGraphNodeId === null) return null;
    return flatRows.find((row) => row.item.kind === 'node' && row.item.nodeId === hoveredGraphNodeId)?.key ?? null;
  }, [flatRows, hoveredGraphNodeId]);

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

  const selectedItem = (hoveredKey ? itemByKey.get(hoveredKey) : null) ?? (selectedKey ? itemByKey.get(selectedKey) : null) ?? null;
  const hintCandidates = useMemo(() => buildSpotlightHints(query), [query]);
  const activeHint = hintCandidates[0] ?? null;

  const highlightedNodeId = useMemo(() => {
    if (selectedItem?.kind === 'node') return selectedItem.nodeId;
    if (selectedItem?.kind === 'action' && selectedItem.target?.kind === 'node') return selectedItem.target.nodeId;
    return null;
  }, [selectedItem]);

  const handleApplyHint = useCallback((hint: string) => {
    setQuery((current) => applySpotlightHint(current, hint));
    setStatusText(null);
  }, []);

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
        const targetNodeId = item.target?.kind === 'node' ? item.target.nodeId : null;
        const targetItem = targetNodeId ? flatRows.find((row) => row.item.kind === 'node' && row.item.nodeId === targetNodeId)?.item : null;
        if (targetItem && targetItem.kind === 'node') {
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

      try {
        const response = await executeSpotlightAction(item.actionId, item.target, query);
        if (response.statusText) setStatusText(response.statusText);
        if (response.closeSpotlight) close();
      } catch (error) {
        console.error('Failed to execute spotlight action:', error);
        setStatusText('Action failed');
      }
      return;
    }

    const actionId = item.kind === 'tree' ? 'open-tree' : 'open';
    const target = item.kind === 'tree'
      ? { kind: 'tree', treeId: item.treeId } as const
      : { kind: 'node', nodeId: item.nodeId } as const;
    try {
      const response = await executeSpotlightAction(actionId, target, query);
      if (response.closeSpotlight) close();
    } catch (error) {
      console.error('Failed to open spotlight result:', error);
      setStatusText('Open failed');
    }
  }, [close, flatRows, query]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const rows = flatRows;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHoveredGraphNodeId(null);
        setSelectedKey((current) => nextSelection(rows, current, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setHoveredGraphNodeId(null);
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
        if (!selectedItem) return;
        void handleActivate(selectedItem, { allowDestructive: event.altKey });
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
  }, [activeHint, close, flatRows, handleActivate, handleApplyHint, helpOpen, hintCandidates, query, selectedItem]);

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
        </div>

        <SpotlightHintRow hints={hintCandidates} activeHint={activeHint} onApply={handleApplyHint} />

        <div className="spotlight-panels spotlight-panels--v3">
          <div className="spotlight-left spotlight-left--v3">
            {loading ? <div className="spotlight-empty">Loading...</div> : <SpotlightSectionList sections={sections} selectedKey={hoveredKey ?? selectedKey} onHoverKey={setSelectedKey} onActivate={handleActivate} />}
          </div>

          <div className="spotlight-right spotlight-right--v3" data-focus={selectedFocusPane}>
            <SpotlightGraphFrame
              highlightNodeId={highlightedNodeId}
              onNavigate={(nodeId) => {
                const item = flatRows.find((row) => row.item.kind === 'node' && row.item.nodeId === nodeId)?.item;
                if (item) void handleActivate(item, { allowDestructive: true });
              }}
              onHoverNode={setHoveredGraphNodeId}
            />
            <SpotlightContextCard item={selectedItem} />
            <SpotlightHelp open={helpOpen} />
          </div>
        </div>

        <SpotlightFooter selectedItem={selectedItem} statusText={statusText} />
      </div>
    </div>
  );
}

function SpotlightSectionList({
  sections,
  selectedKey,
  onHoverKey,
  onActivate,
}: {
  sections: SpotlightSection[];
  selectedKey: string | null;
  onHoverKey: (key: string) => void;
  onActivate: (item: SpotlightSearchResult) => void;
}) {
  if (sections.length === 0) {
    return <div className="spotlight-empty">No results found</div>;
  }

  return (
    <div className="spotlight-sections">
      {sections.map((section) => (
        <div key={section.id} className="spotlight-section">
          <div className="spotlight-section-title">{section.title}</div>
          <div className="spotlight-section-items">
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

function nextSelection(rows: SpotlightSelectableRow[], current: string | null, delta: 1 | -1): string | null {
  if (rows.length === 0) return null;
  const currentIndex = current ? rows.findIndex((row) => row.key === current) : -1;
  const base = currentIndex === -1 ? 0 : currentIndex;
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
  if (item.kind === 'node') return item.groupBadge;
  if (item.kind === 'tree') return item.groupBadge;
  return item.shortcutHint;
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
