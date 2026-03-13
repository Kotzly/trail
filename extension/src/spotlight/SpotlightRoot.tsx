import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { motion, useReducedMotion } from 'motion/react';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import { applySpotlightHint, buildSpotlightHints, computeGhostSuffix } from './SpotlightHintRow.js';
import { SpotlightHelp } from './SpotlightHelp.js';
import { SpotlightActionMenu } from './SpotlightActionMenu.js';
import { SpotlightQuickLook } from './SpotlightQuickLook.js';
import { SpotlightResults } from './SpotlightResults.js';
import { useSpotlightSearch } from './useSpotlightSearch.js';
import { useSpotlightPreview, resolveNodeTarget } from './useSpotlightPreview.js';
import { useSpotlightActions } from './useSpotlightActions.js';
import { useSpotlightKeyboard } from './useSpotlightKeyboard.js';
import { useSelectionIndicator } from './useSelectionIndicator.js';
import { SpotlightBatchBar } from './SpotlightBatchBar.js';
import { useSpotlightResize } from './useSpotlightResize.js';
import { useSpotlightTheme } from './useSpotlightTheme.js';
import { executeBatchAction } from './rpc.js';
import type { SpotlightActionId, SpotlightBatchActionId, SpotlightSearchResult } from './types.js';
import type { SpotlightNodeTarget } from './useSpotlightPreview.js';

type SpotlightRootProps = { onRegisterToggle: (toggle: () => void) => void };

const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
};

export function SpotlightRoot({ onRegisterToggle }: SpotlightRootProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFocusPane, setSelectedFocusPane] = useState<'list' | 'graph'>('list');
  const [helpOpen, setHelpOpen] = useState(false);
  const [hoveredGraphTarget, setHoveredGraphTarget] = useState<SpotlightNodeTarget | null>(null);
  const [selectionIntentId, setSelectionIntentId] = useState(0);
  const [drilldownScope, setDrilldownScope] = useState<{ treeId: string; treeName: string } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const lastCommittedKeyRef = useRef<string | null>(null);
  const drilldownScopeRef = useRef(drilldownScope);
  drilldownScopeRef.current = drilldownScope;
  const drilldownMemoryRef = useRef<{ drilldownScope: { treeId: string; treeName: string }; savedAt: number } | null>(null);
  const drilldownMemoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (drilldownMemoryTimerRef.current) clearTimeout(drilldownMemoryTimerRef.current);
    };
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => { setIsOpen(false); setHelpOpen(false); setDrilldownScope(null); }, []);

  useEffect(() => { onRegisterToggle(toggle); }, [onRegisterToggle, toggle]);
  useEffect(() => { if (isOpen) setHasBeenOpened(true); }, [isOpen]);

  // Domain hooks
  const search = useSpotlightSearch({ isOpen, drilldownScopeTreeId: drilldownScope?.treeId ?? null });
  const activeTreeId = search.bootstrapData?.activeTreeId ?? null;
  const flatItems = useMemo(() => search.sections.flatMap((s) => s.items), [search.sections]);
  const itemByKey = useMemo(() => new Map(flatItems.map((item) => [item.key, item])), [flatItems]);
  const selectedItem = selectedKey ? itemByKey.get(selectedKey) ?? null : null;
  const multiSelectedItems = useMemo(
    () => Array.from(selectedKeys).map((k) => itemByKey.get(k)).filter(Boolean) as SpotlightSearchResult[],
    [selectedKeys, itemByKey],
  );
  const isMultiSelect = selectedKeys.size > 1;

  // Clear multi-select when query or sections change
  useEffect(() => { setSelectedKeys(new Set()); }, [search.query, search.sections]);

  const preview = useSpotlightPreview({
    activeTreeId, drilldownScope, effectiveItem: selectedItem,
    hoveredGraphTarget, sections: search.sections, flatItems, previewCache: search.previewCache,
  });
  const indicatorPos = useSelectionIndicator(listRef, selectedKey);

  const act = useSpotlightActions({
    activeTreeId, query: search.query, close, flatItems,
    previewCache: search.previewCache, setGraphPreviewData: preview.setGraphPreviewData,
    setGraphPreviewLoading: preview.setGraphPreviewLoading, setQuery: search.setQuery,
    setHelpOpen, setDrilldownScope,
  });

  // Echo index O(1) lookup
  const hoveredGraphKey = useMemo(() => {
    if (!hoveredGraphTarget) return null;
    return preview.echoIndex.get(`${hoveredGraphTarget.treeId}:${hoveredGraphTarget.nodeId}`)?.key ?? null;
  }, [hoveredGraphTarget, preview.echoIndex]);
  const hoveredGraphItem = hoveredGraphKey ? itemByKey.get(hoveredGraphKey) ?? null : null;

  // Hints
  const hintCandidates = useMemo(() => buildSpotlightHints(search.query), [search.query]);
  const activeHint = hintCandidates[0] ?? null;
  const ghostSuffix = useMemo(() => computeGhostSuffix(search.query, activeHint), [search.query, activeHint]);
  const handleApplyHint = useCallback((hint: string) => {
    search.setQuery(applySpotlightHint(search.query, hint));
    act.setStatusText(null);
  }, [search, act]);

  const handleBatchExecute = useCallback(async (actionId: SpotlightBatchActionId) => {
    const nodes = multiSelectedItems.filter((i) => i.kind === 'node');
    if (actionId === 'batch-copy-urls') {
      const urls = nodes.map((n) => n.kind === 'node' ? n.url : '').filter(Boolean).join('\n');
      await navigator.clipboard.writeText(urls);
      act.setStatusText(`Copied ${nodes.length} URLs`);
      setSelectedKeys(new Set());
      return;
    }
    const targets = nodes
      .map((n) => n.kind === 'node' ? { kind: 'node' as const, nodeId: n.nodeId, treeId: n.treeId } : null)
      .filter((t): t is NonNullable<typeof t> => t !== null);
    const response = await executeBatchAction(actionId, targets);
    if (response.statusText) act.setStatusText(response.statusText);
    setSelectedKeys(new Set());
  }, [multiSelectedItems, act]);

  // Selection intent
  useEffect(() => {
    if (selectedKey === lastCommittedKeyRef.current) return;
    lastCommittedKeyRef.current = selectedKey;
    setSelectionIntentId((c) => c + 1);
  }, [selectedKey]);

  // Open/close side effects
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
      // Restore drilldown scope from memory if recent
      const memory = drilldownMemoryRef.current;
      if (memory && Date.now() - memory.savedAt < 3 * 60 * 1000) {
        setDrilldownScope(memory.drilldownScope);
      }
      drilldownMemoryRef.current = null;
      return;
    }
    // Save drilldown scope before clearing
    const currentDrilldown = drilldownScopeRef.current;
    if (currentDrilldown) {
      drilldownMemoryRef.current = { drilldownScope: currentDrilldown, savedAt: Date.now() };
      if (drilldownMemoryTimerRef.current) clearTimeout(drilldownMemoryTimerRef.current);
      drilldownMemoryTimerRef.current = setTimeout(() => {
        drilldownMemoryRef.current = null;
        drilldownMemoryTimerRef.current = null;
      }, 3 * 60 * 1000);
    }
    setSelectedKey(null); setHoveredGraphTarget(null); setDrilldownScope(null);
  }, [isOpen]);

  // Graph node resolution
  const selectedNodeTarget = resolveNodeTarget(selectedItem);
  const highlightNodeTarget = hoveredGraphTarget ?? resolveNodeTarget(selectedItem);
  const currentGraphTreeId = preview.previewTreeId ?? activeTreeId;
  const graphSelectedNodeId = currentGraphTreeId && selectedNodeTarget?.treeId === currentGraphTreeId ? selectedNodeTarget.nodeId : null;
  const graphHighlightNodeId = currentGraphTreeId && highlightNodeTarget?.treeId === currentGraphTreeId ? highlightNodeTarget.nodeId : null;

  const handleEscapeKey = useCallback(() => {
    if (act.confirmingAction) {
      act.setConfirmingAction(null);
    } else if (act.quickLookItem) {
      act.setQuickLookItem(null);
    } else if (act.actionMenuActions) {
      act.setActionMenuActions(null);
    } else if (helpOpen) {
      setHelpOpen(false);
    } else if (drilldownScope) {
      act.exitDrilldown();
    } else if (search.query) {
      search.setQuery('');
    } else {
      close();
    }
  }, [act, helpOpen, drilldownScope, search, close]);

  const handleToggleSection = useCallback((sectionId: string) => {
    const isCollapsing = !act.collapsedSections.has(sectionId);
    if (isCollapsing && selectedKey) {
      const section = search.sections.find((s) => s.id === sectionId);
      if (section?.items.some((item) => item.key === selectedKey)) {
        const sectionIndex = search.sections.findIndex((s) => s.id === sectionId);
        let nearestKey: string | null = null;
        // Search sections after the collapsed one, then before
        for (let offset = 1; offset < search.sections.length; offset++) {
          for (const dir of [1, -1] as const) {
            const idx = sectionIndex + offset * dir;
            if (idx < 0 || idx >= search.sections.length) continue;
            const candidate = search.sections[idx]!;
            if (act.collapsedSections.has(candidate.id)) continue;
            if (candidate.items.length > 0) {
              nearestKey = candidate.items[0]!.key;
              break;
            }
          }
          if (nearestKey) break;
        }
        setSelectedKey(nearestKey);
      }
    }
    act.toggleSection(sectionId);
  }, [act, selectedKey, search.sections]);

  useSpotlightKeyboard({
    isOpen, containerRef: backdropRef,
    query: search.query, selectedItem, hoveredGraphItem, activeTreeId, hintCandidates, activeHint,
    actionMenuActions: act.actionMenuActions, setActionMenuActions: act.setActionMenuActions,
    confirmingAction: act.confirmingAction, quickLookItem: act.quickLookItem,
    setQuickLookItem: act.setQuickLookItem, helpOpen, setHelpOpen, drilldownScope,
    selectedFocusPane, setSelectedFocusPane, setQuery: search.setQuery, close,
    exitDrilldown: act.exitDrilldown, handleActivate: act.handleActivate, handleApplyHint,
    handleConfirmDestructive: act.handleConfirmDestructive, setConfirmingAction: act.setConfirmingAction,
    flatItems, selectedKeys, setSelectedKeys, showPreview: true,
  });

  useSpotlightTheme(backdropRef);
  const resize = useSpotlightResize(panelsRef);

  // Always render the backdrop shell so backdropRef is available for the
  // keyboard capture-phase listener on the very first open.
  return (
    <div
      ref={backdropRef}
      className="spotlight-backdrop"
      style={{
        pointerEvents: isOpen ? 'auto' : 'none',
        opacity: isOpen ? 1 : 0,
        ...(!hasBeenOpened && { display: 'none' }),
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      {hasBeenOpened && <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }}
      >
        <Command
          shouldFilter={false} value={selectedKey ?? ''} loop
          onValueChange={(v) => { setSelectedKey(v || null); setHoveredGraphTarget(null); act.setActionMenuActions(null); }}
          className="spotlight-container spotlight-container--v3"
        >
          <div className="spotlight-search spotlight-search--v3">
            <div className="spotlight-input-wrap">
              <Command.Input
                ref={inputRef} className="spotlight-search-input" autoComplete="off" spellCheck={false}
                placeholder={drilldownScope ? `Search in ${drilldownScope.treeName}...` : 'Search pages or type > / for commands'}
                value={search.query} onValueChange={(v) => { search.setQuery(v); act.setStatusText(null); }}
              />
              {ghostSuffix && (
                <span className="spotlight-ghost" aria-hidden="true">
                  <span className="spotlight-ghost-mirror">{search.query}</span>
                  <span className="spotlight-ghost-suffix">{ghostSuffix}</span>
                </span>
              )}
            </div>
          </div>

          {drilldownScope && (
            <div className="spotlight-breadcrumb">
              <button type="button" className="spotlight-breadcrumb-back" onClick={act.exitDrilldown} aria-label="Exit drilldown">←</button>
              <span className="spotlight-breadcrumb-label">{drilldownScope.treeName}</span>
            </div>
          )}

          <div aria-live="polite" aria-atomic="true" style={SR_ONLY}>
            {!search.loading && search.sections.length > 0
              ? `${flatItems.length} result${flatItems.length === 1 ? '' : 's'} found`
              : !search.loading && search.query && search.sections.length === 0 ? 'No results found' : ''}
          </div>

          <div ref={panelsRef} className="spotlight-panels spotlight-panels--v3">
            <div className="spotlight-left spotlight-left--v3" data-focus={selectedFocusPane} style={resize.leftStyle}>
              {search.sessionError ? (
                <div className="spotlight-empty" role="alert">
                  Connection lost.
                  <button type="button" className="spotlight-retry-btn" onClick={search.retryBootstrap}>Retry</button>
                </div>
              ) : helpOpen ? (
                <SpotlightHelp open />
              ) : search.loading ? (
                <div className="spotlight-empty">Loading...</div>
              ) : search.sections.length === 0 && search.query ? (
                <Command.Empty className="spotlight-empty">No results found</Command.Empty>
              ) : search.sections.length === 0 && !search.query && search.recentQueries.length > 0 ? (
                <div className="spotlight-sections spotlight-recent-queries">
                  <div className="spotlight-recent-queries-title">Recent Searches</div>
                  {search.recentQueries.map((q) => (
                    <button
                      key={q} type="button" className="spotlight-recent-query-item"
                      onClick={() => search.setQuery(q)}
                    >
                      <span className="spotlight-recent-query-icon">⌕</span>
                      <span className="spotlight-recent-query-text">{q}</span>
                    </button>
                  ))}
                </div>
              ) : search.sections.length === 0 ? (
                <Command.Empty className="spotlight-empty">No results found</Command.Empty>
              ) : (
                <SpotlightResults
                  listRef={listRef}
                  sections={search.sections}
                  selectedKey={selectedKey}
                  selectedKeys={selectedKeys}
                  collapsedSections={act.collapsedSections}
                  indicatorPos={indicatorPos}
                  activeTreeId={activeTreeId}
                  drilldownTransition={act.drilldownTransition}
                  onToggleSection={handleToggleSection}
                  onActivate={act.handleActivate}
                  onInlineAction={act.handleInlineAction}
                />
              )}
            </div>

            {resize.splitRatio !== null && (
              <div
                className="spotlight-resize-handle"
                data-dragging={resize.isDragging}
                onMouseDown={resize.handleMouseDown}
                role="separator" aria-orientation="vertical" aria-label="Resize panels"
              />
            )}
            <div className="spotlight-right spotlight-right--v3" data-focus={selectedFocusPane} style={resize.rightStyle}>
                  <SpotlightGraphFrame
                    activeTreeId={activeTreeId} previewData={preview.graphPreviewData}
                    selectedNodeId={graphSelectedNodeId} highlightNodeId={graphHighlightNodeId}
                    selectionIntentId={selectionIntentId}
                    onNavigate={(treeId, nodeId) => {
                      const aid: SpotlightActionId = activeTreeId && treeId !== activeTreeId ? 'open-node-in-tree' : 'open';
                      void act.handleExecuteAction(aid, { kind: 'node', nodeId, treeId }, aid === 'open-node-in-tree' ? 'Opened in tree' : 'Opened');
                    }}
                    onHoverNode={(treeId, nodeId) => setHoveredGraphTarget(nodeId === null ? null : { treeId, nodeId })}
                    onEscapeKey={handleEscapeKey}
                  />
              {preview.graphPreviewLoading && <div className="spotlight-graph-loading" role="status" aria-label="Loading tree preview">Loading tree preview...</div>}
              {preview.previewTreeId && !preview.graphPreviewLoading && !preview.graphPreviewData && <div className="spotlight-empty spotlight-graph-fallback">Preview unavailable</div>}
            </div>
          </div>

          {isMultiSelect && (
            <SpotlightBatchBar
              selectedItems={multiSelectedItems}
              activeTreeId={activeTreeId}
              onExecute={handleBatchExecute}
              onClear={() => setSelectedKeys(new Set())}
            />
          )}
          {act.statusText && <div className="spotlight-status-bar" role="status" aria-live="polite"><span className="spotlight-status">{act.statusText}</span></div>}
          {act.actionMenuActions && <SpotlightActionMenu actions={act.actionMenuActions} onSelect={act.handleActionMenuSelect} onClose={() => act.setActionMenuActions(null)} />}
          {act.quickLookItem && (act.quickLookItem.kind === 'node' || act.quickLookItem.kind === 'tree') && (
            <SpotlightQuickLook item={act.quickLookItem} onClose={() => act.setQuickLookItem(null)} onAction={(actionId, target, status) => { act.setQuickLookItem(null); void act.handleExecuteAction(actionId, target, status); }} />
          )}
        </Command>
      </motion.div>}

      {hasBeenOpened && act.confirmingAction && act.confirmingAction.kind === 'action' && (
        <div className="spotlight-confirm-overlay" onClick={() => act.setConfirmingAction(null)}>
          <div className="spotlight-confirm-popup" onClick={(e) => e.stopPropagation()}>
            <div className="spotlight-confirm-icon">⚠</div>
            <div className="spotlight-confirm-title">{act.confirmingAction.title}</div>
            <div className="spotlight-confirm-message">This action cannot be undone.</div>
            <div className="spotlight-confirm-buttons">
              <button type="button" className="spotlight-confirm-btn spotlight-confirm-btn--cancel" onClick={() => act.setConfirmingAction(null)}>Cancel</button>
              <button type="button" className="spotlight-confirm-btn spotlight-confirm-btn--confirm" onClick={() => void act.handleConfirmDestructive()}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
