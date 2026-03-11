import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'motion/react';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import { applySpotlightHint, buildSpotlightHints, computeGhostSuffix } from './SpotlightHintRow.js';
import { SpotlightHelp } from './SpotlightHelp.js';
import { SpotlightActionMenu } from './SpotlightActionMenu.js';
import { SpotlightRowActions } from './SpotlightRowActions.js';
import { SpotlightQuickLook } from './SpotlightQuickLook.js';
import { SpotlightRowIcon } from './SpotlightRowIcon.js';
import { highlightText } from './highlight.js';
import { useSpotlightSearch } from './useSpotlightSearch.js';
import { useSpotlightPreview, resolveNodeTarget } from './useSpotlightPreview.js';
import { useSpotlightActions } from './useSpotlightActions.js';
import { useSpotlightKeyboard } from './useSpotlightKeyboard.js';
import { useSelectionIndicator } from './useSelectionIndicator.js';
import { SpotlightBatchBar } from './SpotlightBatchBar.js';
import { executeBatchAction } from './rpc.js';
import type { SpotlightActionId, SpotlightBatchActionId, SpotlightSearchResult } from './types.js';
import type { SpotlightNodeTarget } from './useSpotlightPreview.js';

type SpotlightRootProps = { onRegisterToggle: (toggle: () => void) => void };

const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
};

const SPRING_TRANSITION = { type: 'spring' as const, stiffness: 400, damping: 35 };

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
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const lastCommittedKeyRef = useRef<string | null>(null);

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
    hoveredGraphTarget, sections: search.sections, previewCache: search.previewCache,
  });
  const showPreview = activeTreeId !== null || preview.previewTreeId !== null;
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
    const targets = nodes.map((n) => n.kind === 'node' ? { kind: 'node' as const, nodeId: n.nodeId, treeId: n.treeId } : null).filter(Boolean);
    const response = await executeBatchAction(actionId, targets as Array<{ kind: string; nodeId?: any; treeId?: string }>);
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
    if (isOpen) { requestAnimationFrame(() => inputRef.current?.focus()); return; }
    setSelectedKey(null); setHoveredGraphTarget(null); setDrilldownScope(null);
  }, [isOpen]);

  // Graph node resolution
  const selectedNodeTarget = resolveNodeTarget(selectedItem);
  const highlightNodeTarget = hoveredGraphTarget ?? resolveNodeTarget(selectedItem);
  const currentGraphTreeId = preview.previewTreeId ?? activeTreeId;
  const graphSelectedNodeId = currentGraphTreeId && selectedNodeTarget?.treeId === currentGraphTreeId ? selectedNodeTarget.nodeId : null;
  const graphHighlightNodeId = currentGraphTreeId && highlightNodeTarget?.treeId === currentGraphTreeId ? highlightNodeTarget.nodeId : null;

  const { handleKeyDownCapture } = useSpotlightKeyboard({
    query: search.query, selectedItem, hoveredGraphItem, activeTreeId, hintCandidates, activeHint,
    actionMenuActions: act.actionMenuActions, setActionMenuActions: act.setActionMenuActions,
    confirmingAction: act.confirmingAction, quickLookItem: act.quickLookItem,
    setQuickLookItem: act.setQuickLookItem, helpOpen, setHelpOpen, drilldownScope,
    selectedFocusPane, setSelectedFocusPane, setQuery: search.setQuery, close,
    exitDrilldown: act.exitDrilldown, handleActivate: act.handleActivate, handleApplyHint,
    handleConfirmDestructive: act.handleConfirmDestructive, setConfirmingAction: act.setConfirmingAction,
    flatItems, selectedKeys, setSelectedKeys, showPreview,
  });

  // Reset focus pane when preview closes
  useEffect(() => {
    if (!showPreview && selectedFocusPane === 'graph') setSelectedFocusPane('list');
  }, [showPreview, selectedFocusPane]);

  if (!hasBeenOpened) return null;

  return (
    <div
      className="spotlight-backdrop"
      style={{ pointerEvents: isOpen ? 'auto' : 'none', opacity: isOpen ? 1 : 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }}
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
              <button type="button" className="spotlight-breadcrumb-back" onClick={act.exitDrilldown} tabIndex={-1} aria-label="Exit drilldown">←</button>
              <span className="spotlight-breadcrumb-label">{drilldownScope.treeName}</span>
            </div>
          )}

          <div aria-live="polite" aria-atomic="true" style={SR_ONLY}>
            {!search.loading && search.sections.length > 0
              ? `${flatItems.length} result${flatItems.length === 1 ? '' : 's'} found`
              : !search.loading && search.query && search.sections.length === 0 ? 'No results found' : ''}
          </div>

          <div className="spotlight-panels spotlight-panels--v3">
            <motion.div
              className="spotlight-left spotlight-left--v3"
              data-focus={selectedFocusPane}
              layout
              transition={SPRING_TRANSITION}
              style={{ flex: showPreview ? '0 0 400px' : '1 1 100%' }}
            >
              {search.sessionError ? (
                <div className="spotlight-empty" role="alert">Connection lost. Close and reopen spotlight to retry.</div>
              ) : helpOpen ? (
                <SpotlightHelp open />
              ) : search.loading ? (
                <div className="spotlight-empty">Loading...</div>
              ) : search.sections.length === 0 ? (
                <Command.Empty className="spotlight-empty">No results found</Command.Empty>
              ) : (
                <Command.List ref={listRef as React.Ref<HTMLDivElement>} className="spotlight-sections" data-transition={act.drilldownTransition}>
                  {indicatorPos && (
                    <motion.div
                      className="spotlight-selection-indicator"
                      animate={{ y: indicatorPos.top, height: indicatorPos.height }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  {search.sections.map((section, i) => {
                    const collapsed = act.collapsedSections.has(section.id);
                    return (
                      <Command.Group
                        key={section.id}
                        heading={
                          <button type="button" className="spotlight-section-toggle" onClick={() => act.toggleSection(section.id)} tabIndex={-1} aria-label={collapsed ? 'Expand section' : 'Collapse section'} aria-expanded={!collapsed}>
                            <span className="spotlight-section-chevron" data-collapsed={collapsed} />
                            {section.title}
                            <span className="spotlight-section-count">{section.items.length}</span>
                          </button>
                        }
                        className="spotlight-section" data-first={i === 0} data-collapsed={collapsed}
                      >
                        {!collapsed && section.items.map((item) => (
                          <Command.Item key={item.key} value={item.key} className={`spotlight-row spotlight-row--${item.kind}`} data-destructive={item.kind === 'action' && item.safety === 'destructive'} data-multi-selected={selectedKeys.has(item.key)} onSelect={() => { void act.handleActivate(item); }}>
                            <SpotlightRowIcon item={item} />
                            <div className="spotlight-row-main">
                              <div className="spotlight-row-title">{renderItemTitle(item)}</div>
                              <div className="spotlight-row-subtitle">{renderItemSubtitle(item)}</div>
                            </div>
                            {item.key === selectedKey && item.kind !== 'action' ? (
                              <SpotlightRowActions item={item} activeTreeId={activeTreeId} onAction={act.handleInlineAction} />
                            ) : (
                              <div className="spotlight-row-meta">{getItemMeta(item)}</div>
                            )}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    );
                  })}
                </Command.List>
              )}
            </motion.div>

            <AnimatePresence mode="popLayout">
              {showPreview && (
                <motion.div
                  key="preview-panel"
                  className="spotlight-right spotlight-right--v3"
                  data-focus={selectedFocusPane}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={SPRING_TRANSITION}
                >
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
                  {preview.graphPreviewLoading && <div className="spotlight-graph-loading" role="status" aria-label="Loading tree preview">Loading tree preview...</div>}
                  {preview.previewTreeId && !preview.graphPreviewLoading && !preview.graphPreviewData && <div className="spotlight-empty spotlight-graph-fallback">Preview unavailable</div>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isMultiSelect && (
            <SpotlightBatchBar
              selectedItems={multiSelectedItems}
              activeTreeId={activeTreeId}
              onExecute={handleBatchExecute}
              onClear={() => setSelectedKeys(new Set())}
            />
          )}
          {act.statusText && <div className="spotlight-status-bar"><span className="spotlight-status">{act.statusText}</span></div>}
          {act.actionMenuActions && <SpotlightActionMenu actions={act.actionMenuActions} onSelect={act.handleActionMenuSelect} onClose={() => act.setActionMenuActions(null)} />}
          {act.quickLookItem && (act.quickLookItem.kind === 'node' || act.quickLookItem.kind === 'tree') && (
            <SpotlightQuickLook item={act.quickLookItem} onClose={() => act.setQuickLookItem(null)} onAction={(actionId, target, status) => { act.setQuickLookItem(null); void act.handleExecuteAction(actionId, target, status); }} />
          )}
        </Command>
      </motion.div>

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

function renderItemTitle(item: SpotlightSearchResult): ReactNode {
  return item.kind === 'node' ? highlightText(item.title, item.highlights.title)
    : item.kind === 'tree' ? highlightText(item.treeName, item.highlights.title)
    : item.title;
}

function renderItemSubtitle(item: SpotlightSearchResult): ReactNode {
  if (item.kind === 'node') {
    return <span className="spotlight-mono">{highlightText(item.url, item.highlights.url)}</span>;
  }
  if (item.kind === 'tree') {
    if (!item.rootUrl) return 'Archived tree';
    return <span className="spotlight-mono">{highlightText(item.rootUrl, item.highlights.url)}</span>;
  }
  if (item.subtitle.startsWith('http')) {
    return <span className="spotlight-mono">{item.subtitle}</span>;
  }
  return item.subtitle;
}

function getItemMeta(item: SpotlightSearchResult): string {
  if (item.kind === 'node') return item.group === 'other-trees' ? item.treeName : item.pinned ? 'Pinned' : item.groupBadge;
  return item.kind === 'tree' ? item.groupBadge : item.shortcutHint;
}
