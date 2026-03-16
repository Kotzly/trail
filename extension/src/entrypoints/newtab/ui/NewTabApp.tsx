import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { Search, ChevronRight, FolderOpen } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import { SpotlightGraphFrame } from '../../../spotlight/SpotlightGraphFrame.js';
import { applySpotlightHint, buildSpotlightHints, computeGhostSuffix } from '../../../spotlight/SpotlightHintRow.js';
import { SpotlightHelp } from '../../../spotlight/SpotlightHelp.js';
import { SpotlightActionMenu } from '../../../spotlight/SpotlightActionMenu.js';
import { SpotlightQuickLook } from '../../../spotlight/SpotlightQuickLook.js';
import { SpotlightResults } from '../../../spotlight/SpotlightResults.js';
import { useSpotlightSearch } from '../../../spotlight/useSpotlightSearch.js';
import { useSpotlightPreview, resolveNodeTarget } from '../../../spotlight/useSpotlightPreview.js';
import { useSpotlightActions } from '../../../spotlight/useSpotlightActions.js';
import { useSpotlightKeyboard } from '../../../spotlight/useSpotlightKeyboard.js';
import { useSelectionIndicator } from '../../../spotlight/useSelectionIndicator.js';
import { SpotlightBatchBar } from '../../../spotlight/SpotlightBatchBar.js';
import { executeBatchAction, executeSpotlightAction } from '../../../spotlight/rpc.js';
import { SpotlightFooter } from '../../../spotlight/SpotlightFooter.js';
import { resolveSpotlightQueryMode } from '@shared/lib/spotlight/query-dsl.js';
import { browser } from '@shared/platform/webext.js';
import { useBookmarks } from './useBookmarks.js';
import { DashboardView } from './DashboardView.js';
import { QuickActions } from './QuickActions.js';
import type { SpotlightActionId, SpotlightBatchActionId, SpotlightMode, SpotlightSearchResult } from '../../../spotlight/types.js';
import type { SpotlightNodeTarget } from '../../../spotlight/useSpotlightPreview.js';
import type { NodeId } from '@shared/types/ids.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOOP = () => {};

const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
};

const DRAG_STORAGE_KEY = 'trail_newtab_island_pos';

function loadDragPos(): { x: number; y: number } | undefined {
  try {
    const raw = localStorage.getItem(DRAG_STORAGE_KEY);
    if (!raw) return undefined;
    const pos = JSON.parse(raw);
    if (typeof pos.x === 'number' && typeof pos.y === 'number') {
      // Reject corrupted values from previous broken info.point save
      if (Math.abs(pos.x) > 500 || Math.abs(pos.y) > 500) {
        localStorage.removeItem(DRAG_STORAGE_KEY);
        return undefined;
      }
      return pos;
    }
  } catch { /* ignore */ }
  return undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewTabApp() {
  // ─── State ───
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFocusPane, setSelectedFocusPane] = useState<'list' | 'graph'>('list');
  const [helpOpen, setHelpOpen] = useState(false);
  const [hoveredGraphTarget, setHoveredGraphTarget] = useState<SpotlightNodeTarget | null>(null);
  const [selectionIntentId, setSelectionIntentId] = useState(0);
  const [drilldownScope, setDrilldownScope] = useState<{ treeId: string; treeName: string } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [graphFocusMode, setGraphFocusMode] = useState(false);

  const { bookmarks } = useBookmarks();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const graphBgRef = useRef<HTMLDivElement>(null);
  const lastCommittedKeyRef = useRef<string | null>(null);

  // ─── Domain hooks ───
  const search = useSpotlightSearch({ isOpen: true, drilldownScopeTreeId: drilldownScope?.treeId ?? null });
  const activeTreeId = search.bootstrapData?.activeTreeId ?? null;
  const flatItems = useMemo(() => search.sections.flatMap((s) => s.items), [search.sections]);
  const itemByKey = useMemo(() => new Map(flatItems.map((item) => [item.key, item])), [flatItems]);
  const selectedItem = selectedKey ? itemByKey.get(selectedKey) ?? null : null;
  const multiSelectedItems = useMemo(
    () => Array.from(selectedKeys).map((k) => itemByKey.get(k)).filter(Boolean) as SpotlightSearchResult[],
    [selectedKeys, itemByKey],
  );
  const isMultiSelect = selectedKeys.size > 1;
  const spotlightMode = resolveSpotlightQueryMode(search.query).mode as SpotlightMode;
  const isIdle = !search.query && !graphFocusMode;

  // Continue items (first section in discover mode)
  const continueItems = useMemo(() => {
    if (search.query) return [];
    const firstSection = search.sections[0];
    return firstSection ? firstSection.items : [];
  }, [search.query, search.sections]);

  // Clear multi-select when query or results change
  useEffect(() => { setSelectedKeys(new Set()); }, [search.query, search.sections]);

  // Auto-focus search on mount
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const attemptFocus = () => { window.focus(); input.focus(); };
    attemptFocus();
    const timers = [0, 50, 150, 300].map((delay) =>
      setTimeout(() => { if (document.activeElement !== input) attemptFocus(); }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Listen for TOGGLE_SPOTLIGHT
  useEffect(() => {
    const handler = (message: { type?: string }) => {
      if (message?.type === 'TOGGLE_SPOTLIGHT') inputRef.current?.focus();
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  // Mouse parallax — shifts graph bg opposite to cursor for depth.
  // Loop auto-stops when converged, restarts on next mousemove.
  useEffect(() => {
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const MAX_X = 20;
    const MAX_Y = 14;
    const EASE = 0.04;
    const SETTLE_THRESHOLD = 0.1; // px — stop loop when both axes within this
    let rafId: number | null = null;
    let running = false;

    const update = () => {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;

      // Stop loop when converged to avoid continuous recomposites
      if (Math.abs(target.x - current.x) < SETTLE_THRESHOLD && Math.abs(target.y - current.y) < SETTLE_THRESHOLD) {
        current.x = target.x;
        current.y = target.y;
        running = false;
        rafId = null;
      } else {
        rafId = requestAnimationFrame(update);
      }

      const el = graphBgRef.current;
      if (el) {
        el.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;
      }
    };

    const startLoop = () => {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(update);
    };

    const onMove = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * -MAX_X * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * -MAX_Y * 2;
      startLoop();
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Cmd+G: toggle graph focus mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = /Mac|iPhone|iPad/.test(navigator.userAgent) ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'g') {
        e.preventDefault();
        setGraphFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // ─── Preview ───
  const preview = useSpotlightPreview({
    activeTreeId, drilldownScope, effectiveItem: selectedItem,
    hoveredGraphTarget, sections: search.sections, flatItems, previewCache: search.previewCache,
  });
  const indicatorPos = useSelectionIndicator(listRef, selectedKey);

  // ─── Actions ───
  const act = useSpotlightActions({
    activeTreeId, query: search.query, close: NOOP, flatItems,
    previewCache: search.previewCache, setGraphPreviewData: preview.setGraphPreviewData,
    setGraphPreviewLoading: preview.setGraphPreviewLoading, setQuery: search.setQuery,
    setHelpOpen, setDrilldownScope,
  });

  // ─── Hints ───
  const hintCandidates = useMemo(() => buildSpotlightHints(search.query), [search.query]);
  const activeHint = hintCandidates[0] ?? null;
  const ghostSuffix = useMemo(() => computeGhostSuffix(search.query, activeHint), [search.query, activeHint]);
  const handleApplyHint = useCallback((hint: string) => {
    search.setQuery(applySpotlightHint(search.query, hint));
    act.setStatusText(null);
  }, [search, act]);

  // ─── Graph echo ───
  const hoveredGraphKey = useMemo(() => {
    if (!hoveredGraphTarget) return null;
    return preview.echoIndex.get(`${hoveredGraphTarget.treeId}:${hoveredGraphTarget.nodeId}`)?.key ?? null;
  }, [hoveredGraphTarget, preview.echoIndex]);
  const hoveredGraphItem = hoveredGraphKey ? itemByKey.get(hoveredGraphKey) ?? null : null;

  // ─── Batch ───
  const handleBatchExecute = useCallback(async (actionId: SpotlightBatchActionId) => {
    const nodes = multiSelectedItems.filter((i) => i.kind === 'node');
    if (actionId === 'batch-copy-urls') {
      const urls = nodes.map((n) => n.kind === 'node' ? n.url : '').filter(Boolean).join('\n');
      await navigator.clipboard.writeText(urls);
      act.setStatusText(`Copied ${nodes.length} URLs`);
      setSelectedKeys(new Set());
      return;
    }
    const targets: Array<{ kind: string; nodeId: NodeId; treeId: string }> = [];
    for (const n of nodes) {
      if (n.kind === 'node') targets.push({ kind: 'node', nodeId: n.nodeId, treeId: n.treeId });
    }
    const response = await executeBatchAction(actionId, targets);
    if (response.statusText) act.setStatusText(response.statusText);
    setSelectedKeys(new Set());
  }, [multiSelectedItems, act]);

  // ─── Selection intent (for graph sync) ───
  useEffect(() => {
    if (selectedKey === lastCommittedKeyRef.current) return;
    lastCommittedKeyRef.current = selectedKey;
    setSelectionIntentId((c) => c + 1);
  }, [selectedKey]);

  // ─── Graph node resolution ───
  const selectedNodeTarget = resolveNodeTarget(selectedItem);
  const highlightNodeTarget = hoveredGraphTarget ?? resolveNodeTarget(selectedItem);
  const currentGraphTreeId = preview.previewTreeId ?? activeTreeId;
  const graphSelectedNodeId = currentGraphTreeId && selectedNodeTarget?.treeId === currentGraphTreeId
    ? selectedNodeTarget.nodeId : null;
  const graphHighlightNodeId = currentGraphTreeId && highlightNodeTarget?.treeId === currentGraphTreeId
    ? highlightNodeTarget.nodeId : null;

  // ─── Visible items ───
  const visibleFlatItems = useMemo(
    () => search.sections.filter((s) => !act.collapsedSections.has(s.id)).flatMap((s) => s.items),
    [search.sections, act.collapsedSections],
  );

  // ─── Section toggle ───
  const handleToggleSection = useCallback((sectionId: string) => {
    const isCollapsing = !act.collapsedSections.has(sectionId);
    if (isCollapsing && selectedKey) {
      const section = search.sections.find((s) => s.id === sectionId);
      if (section?.items.some((item) => item.key === selectedKey)) {
        const sectionIndex = search.sections.findIndex((s) => s.id === sectionId);
        let nearestKey: string | null = null;
        for (let offset = 1; offset < search.sections.length; offset++) {
          for (const dir of [1, -1] as const) {
            const idx = sectionIndex + offset * dir;
            if (idx < 0 || idx >= search.sections.length) continue;
            const candidate = search.sections[idx]!;
            if (act.collapsedSections.has(candidate.id)) continue;
            if (candidate.items.length > 0) { nearestKey = candidate.items[0]!.key; break; }
          }
          if (nearestKey) break;
        }
        setSelectedKey(nearestKey);
      }
    }
    act.toggleSection(sectionId);
  }, [act, selectedKey, search.sections]);

  // ─── Web search (Cmd+Enter) ───
  const handleSearchWeb = useCallback((query: string) => {
    void executeSpotlightAction('search-default-engine', { kind: 'search', query });
  }, []);

  // ─── Keyboard ───
  const toggleGraphPanel = useCallback(() => {}, []);
  const stepSnapPoint = useCallback((_dir: 1 | -1) => {}, []);

  useSpotlightKeyboard({
    isOpen: true, containerRef: rootRef,
    query: search.query, selectedItem, selectedKey, setSelectedKey,
    hoveredGraphItem, activeTreeId, hintCandidates, activeHint,
    actionMenuActions: act.actionMenuActions, setActionMenuActions: act.setActionMenuActions,
    confirmingAction: act.confirmingAction, quickLookItem: act.quickLookItem,
    setQuickLookItem: act.setQuickLookItem, helpOpen, setHelpOpen, drilldownScope,
    selectedFocusPane, setSelectedFocusPane, setQuery: search.setQuery, close: NOOP,
    exitDrilldown: act.exitDrilldown, handleActivate: act.handleActivate, handleApplyHint,
    handleConfirmDestructive: act.handleConfirmDestructive, setConfirmingAction: act.setConfirmingAction,
    flatItems, visibleFlatItems, selectedKeys, setSelectedKeys, showPreview: true,
    toggleGraphPanel, stepSnapPoint, onSearchWeb: handleSearchWeb,
  });

  // ─── Anchor mode class ───
  const anchorClass = graphFocusMode
    ? 'newtab-island-anchor newtab-island-anchor--graph-focus'
    : isIdle
      ? 'newtab-island-anchor newtab-island-anchor--idle'
      : 'newtab-island-anchor newtab-island-anchor--searching';

  // ─── Drag position ───
  const [initDragPos] = useState(loadDragPos);
  const dragX = useMotionValue(initDragPos?.x ?? 0);
  const dragY = useMotionValue(initDragPos?.y ?? 0);

  // ─── Render ───
  return (
    <div className="newtab" ref={rootRef}>
      {/* ── Graph: fullscreen background ── */}
      <div ref={graphBgRef} className={`newtab-graph-bg${graphFocusMode ? ' newtab-graph-bg--focus' : ''}`}>
        <SpotlightGraphFrame
          activeTreeId={activeTreeId} previewData={preview.graphPreviewData}
          selectedNodeId={graphSelectedNodeId} highlightNodeId={graphHighlightNodeId}
          selectionIntentId={selectionIntentId}
          onNavigate={(treeId, nodeId) => {
            const aid: SpotlightActionId = activeTreeId && treeId !== activeTreeId ? 'open-node-in-tree' : 'open';
            void act.handleExecuteAction(aid, { kind: 'node', nodeId, treeId }, aid === 'open-node-in-tree' ? 'Opened in tree' : 'Opened');
          }}
          onHoverNode={(treeId, nodeId) => setHoveredGraphTarget(nodeId === null ? null : { treeId, nodeId })}
        />
      </div>

      {/* ── Centering anchor (transparent to mouse — clicks go to graph) ── */}
      <div className={anchorClass} ref={anchorRef}>
        {/* ── Draggable island (sized to content) ── */}
        <motion.div
          drag
          dragConstraints={anchorRef}
          dragElastic={0.05}
          dragMomentum={false}
          onDragEnd={() => {
            try {
              localStorage.setItem(DRAG_STORAGE_KEY, JSON.stringify({ x: dragX.get(), y: dragY.get() }));
            } catch { /* ignore */ }
          }}
          style={{ x: dragX, y: dragY }}
          className="newtab-island-drag"
        >
          <Command
            shouldFilter={false} value={selectedKey ?? ''} loop
            onValueChange={(v) => { setSelectedKey(v || null); setHoveredGraphTarget(null); act.setActionMenuActions(null); }}
            className="newtab-island"
          >
          {/* ── Search bar ── */}
          <motion.div className="spotlight-search newtab-search" layout="position" transition={{ duration: 0.25 }}>
            <div className="spotlight-scope-icon" aria-hidden="true">
              {spotlightMode === 'commands' ? (
                <ChevronRight size={15} strokeWidth={1.8} />
              ) : drilldownScope ? (
                <FolderOpen size={15} strokeWidth={1.8} />
              ) : (
                <Search size={15} strokeWidth={1.8} />
              )}
            </div>
            <div className="spotlight-input-wrap">
              <Command.Input
                ref={inputRef} className="spotlight-search-input" autoComplete="off" autoFocus spellCheck={false}
                placeholder={drilldownScope ? `Search in ${drilldownScope.treeName}...` : 'Search pages or type > for commands'}
                value={search.query} onValueChange={(v: string) => { search.setQuery(v); act.setStatusText(null); }}
              />
              {ghostSuffix && (
                <span className="spotlight-ghost" aria-hidden="true">
                  <span className="spotlight-ghost-mirror">{search.query}</span>
                  <span className="spotlight-ghost-suffix">{ghostSuffix}</span>
                </span>
              )}
            </div>
          </motion.div>

          {/* ── Content: Dashboard (idle) or Results (searching) ── */}
          <AnimatePresence mode="wait">
            {isIdle && !graphFocusMode ? (
              <motion.div
                key="dashboard"
                className="newtab-island-panel"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <QuickActions onAction={(filter) => search.setQuery(filter)} />
                <DashboardView
                  bookmarks={bookmarks}
                  recentQueries={search.recentQueries}
                  continueItems={continueItems}
                  onQueryChange={search.setQuery}
                  onActivate={act.handleActivate}
                />
              </motion.div>
            ) : !graphFocusMode ? (
              <motion.div
                key="results"
                className="newtab-island-panel"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* ── Breadcrumb ── */}
                {drilldownScope && (
                  <div className="spotlight-breadcrumb">
                    <button type="button" className="spotlight-breadcrumb-back" onClick={act.exitDrilldown} tabIndex={-1} aria-label="Exit drilldown">
                      ←
                    </button>
                    <span className="spotlight-breadcrumb-label">{drilldownScope.treeName}</span>
                  </div>
                )}

                {/* ── A11y live region ── */}
                <div aria-live="polite" aria-atomic="true" style={SR_ONLY}>
                  {!search.loading && search.sections.length > 0
                    ? `${flatItems.length} result${flatItems.length === 1 ? '' : 's'} found`
                    : !search.loading && search.query && search.sections.length === 0 ? 'No results found' : ''}
                </div>

                {/* ── Results list ── */}
                <div className="newtab-list">
                  {search.sessionError ? (
                    <div className="spotlight-empty" role="alert">Connection lost. Reload to retry.</div>
                  ) : helpOpen ? (
                    <SpotlightHelp open />
                  ) : search.loading ? (
                    <div className="newtab-shimmer" style={{ margin: '12px' }} />
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
                      onSelect={setSelectedKey}
                      onActivate={act.handleActivate}
                      onInlineAction={act.handleInlineAction}
                    />
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Batch bar ── */}
          {isMultiSelect && (
            <SpotlightBatchBar
              selectedItems={multiSelectedItems}
              activeTreeId={activeTreeId}
              onExecute={handleBatchExecute}
              onClear={() => setSelectedKeys(new Set())}
            />
          )}

          {/* ── Status ── */}
          {act.statusText && (
            <div className="spotlight-status-bar">
              <span className="spotlight-status">{act.statusText}</span>
            </div>
          )}

          {/* ── Action menu overlay ── */}
          {act.actionMenuActions && (
            <SpotlightActionMenu
              actions={act.actionMenuActions}
              onSelect={act.handleActionMenuSelect}
              onClose={() => act.setActionMenuActions(null)}
            />
          )}

          {/* ── Quick look overlay ── */}
          {act.quickLookItem && (act.quickLookItem.kind === 'node' || act.quickLookItem.kind === 'tree') && (
            <SpotlightQuickLook
              item={act.quickLookItem}
              onClose={() => act.setQuickLookItem(null)}
              onAction={(actionId, target, status) => {
                act.setQuickLookItem(null);
                void act.handleExecuteAction(actionId, target, status);
              }}
            />
          )}
          </Command>
        </motion.div>
      </div>

      {/* ── Footer: fixed bottom-left, outside the island ── */}
      {!graphFocusMode && (
        <SpotlightFooter mode={spotlightMode} isMultiSelect={isMultiSelect} focusPane={selectedFocusPane} showWebSearchHint={search.query.trim().length > 0} />
      )}

      {/* ── Graph focus exit button ── */}
      {graphFocusMode && (
        <button
          type="button"
          className="newtab-graph-exit"
          onClick={() => setGraphFocusMode(false)}
        >
          Press Esc or click to exit graph · ⌘G
        </button>
      )}

      {/* ── Destructive confirmation overlay ── */}
      {act.confirmingAction && act.confirmingAction.kind === 'action' && (
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
