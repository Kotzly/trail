import { useEffect, useRef } from 'react';
import type { LayoutMode, Settings } from '../../../shared/types/settings.js';
import type { NavigationNode } from '../../../shared/types/node.js';
import { saveSettings } from '../../api/settings.js';
import { notificationCenter } from '../notifications/notification-center.js';
import { useStore } from '../state/store.js';

const TREE_MAX_CHILDREN = 8;
const TREE_MIN_DEPTH = 20;
const TREE_STAY_MAX_CHILDREN = 10;
const TREE_STAY_MIN_DEPTH = 18;

const RADIAL_MIN_CHILDREN = 20;
const RADIAL_MAX_DEPTH = 15;
const RADIAL_MAX_AVG_DEPTH = 20;
const RADIAL_STAY_MIN_CHILDREN = 18;
const RADIAL_STAY_MAX_DEPTH = 17;
const RADIAL_STAY_MAX_AVG_DEPTH = 22;

const MINDMAP_MAX_CHILDREN = 20;
const MINDMAP_MAX_DEPTH = 10;
const MINDMAP_MAX_AVG_DEPTH = 10;
const MINDMAP_STAY_MAX_CHILDREN = 22;
const MINDMAP_STAY_MAX_DEPTH = 12;
const MINDMAP_STAY_MAX_AVG_DEPTH = 12;

const DEFAULT_ADAPTIVE_LAYOUTS: Settings['adaptiveModeLayouts'] = {
  mindmap: true,
  tree: true,
  radial: true,
};

function getMaxDepth(node: NavigationNode | null, depth = 1): number {
  if (!node) return 0;
  const children = node.getChildren?.() ?? [];
  if (children.length === 0) return depth;
  let max = depth;
  for (const child of children) {
    max = Math.max(max, getMaxDepth(child, depth + 1));
  }
  return max;
}

function getBranchDepths(root: NavigationNode | null): number[] {
  if (!root) return [];
  const children = root.getChildren?.() ?? [];
  if (children.length === 0) return [];
  return children.map((child) => getMaxDepth(child, 2));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function chooseLayout(
  root: NavigationNode | null,
  currentMode: LayoutMode,
  allowedLayouts: Settings['adaptiveModeLayouts'],
) {
  if (!root) return null;
  let maxChildren = 0;
  root.forEach((node) => {
    maxChildren = Math.max(maxChildren, node.getChildren?.()?.length ?? 0);
  });
  const maxDepth = getMaxDepth(root);
  const branchDepths = getBranchDepths(root);
  const avgDepth = average(branchDepths);

  const treeFit = maxChildren > 0 && maxChildren < TREE_MAX_CHILDREN && maxDepth >= TREE_MIN_DEPTH;
  const treeStay =
    maxChildren > 0 && maxChildren < TREE_STAY_MAX_CHILDREN && maxDepth >= TREE_STAY_MIN_DEPTH;
  const radialFit =
    maxChildren > RADIAL_MIN_CHILDREN && maxDepth <= RADIAL_MAX_DEPTH && avgDepth <= RADIAL_MAX_AVG_DEPTH;
  const radialStay =
    maxChildren > RADIAL_STAY_MIN_CHILDREN &&
    maxDepth <= RADIAL_STAY_MAX_DEPTH &&
    avgDepth <= RADIAL_STAY_MAX_AVG_DEPTH;
  const mindmapFit =
    maxChildren <= MINDMAP_MAX_CHILDREN && maxDepth <= MINDMAP_MAX_DEPTH && avgDepth <= MINDMAP_MAX_AVG_DEPTH;
  const mindmapStay =
    maxChildren <= MINDMAP_STAY_MAX_CHILDREN &&
    maxDepth <= MINDMAP_STAY_MAX_DEPTH &&
    avgDepth <= MINDMAP_STAY_MAX_AVG_DEPTH;

  const allowTree = allowedLayouts.tree;
  const allowRadial = allowedLayouts.radial;
  const allowMindmap = allowedLayouts.mindmap;

  const candidate =
    currentMode === 'tree' && allowTree && treeStay
      ? 'tree'
      : currentMode === 'radial' && allowRadial && radialStay
        ? 'radial'
        : currentMode === 'mindmap' && allowMindmap && mindmapStay
          ? 'mindmap'
          : treeFit && allowTree
            ? 'tree'
            : radialFit && allowRadial
              ? 'radial'
              : mindmapFit && allowMindmap
                ? 'mindmap'
                : null;

  return { candidate, maxChildren, maxDepth, avgDepth };
}

async function applyLayoutMode(settings: Settings, mode: LayoutMode, setSettings: (next: Settings) => void) {
  if (settings.layout.mode === mode) return;
  const next = {
    ...settings,
    layout: {
      ...settings.layout,
      mode,
    },
  };
  setSettings(next);
  try {
    await saveSettings(next);
  } catch (error) {
    console.error('Failed to save adaptive layout:', error);
  }
}

function getAdaptiveStartMode(layouts: Settings['adaptiveModeLayouts']): LayoutMode | null {
  if (layouts.mindmap) return 'mindmap';
  if (layouts.tree) return 'tree';
  if (layouts.radial) return 'radial';
  return null;
}

export function useAdaptiveMode(): void {
  const settings = useStore((state) => state.settings);
  const tree = useStore((state) => state.tree);
  const treeUpdate = useStore((state) => state.treeUpdate);

  const sessionRef = useRef({
    rootId: null as number | null,
    suggestedTree: false,
    suggestedRadial: false,
  });

  useEffect(() => {
    if (!settings?.adaptiveMode) return;
    const adaptiveLayouts = settings.adaptiveModeLayouts ?? DEFAULT_ADAPTIVE_LAYOUTS;
    const startMode = getAdaptiveStartMode(adaptiveLayouts);

    const root = tree?.getRoot?.() ?? null;
    const rootId = root?.id ?? null;
    const isReset = treeUpdate?.reason === 'tree-reset' || treeUpdate?.reason === 'tree-switch';

    const applyMode = (mode: LayoutMode) => {
      const state = useStore.getState();
      if (!state.settings) return;
      void applyLayoutMode(state.settings, mode, state.setSettings);
    };

    if (sessionRef.current.rootId !== rootId) {
      sessionRef.current = { rootId, suggestedTree: false, suggestedRadial: false };
      if (rootId !== null && startMode) {
        applyMode(startMode);
      }
      if (isReset) return;
    } else if (isReset) {
      sessionRef.current = { rootId, suggestedTree: false, suggestedRadial: false };
      if (startMode) {
        applyMode(startMode);
      }
      return;
    }

    if (!root) return;

    const decision = chooseLayout(root, settings.layout.mode, adaptiveLayouts);
    if (!decision) return;

    if (decision.candidate === 'tree') {
      if (settings.layout.mode === 'tree') {
        sessionRef.current.suggestedTree = true;
        return;
      }
      if (!sessionRef.current.suggestedTree) {
        sessionRef.current.suggestedTree = true;
        notificationCenter.notify({
          message: 'Few branches but deep paths detected. Switch to Tree layout?',
          icon: 'Network',
          durationMs: 10000,
          actions: true,
          onConfirm: () => applyMode('tree'),
          onCancel: () => undefined,
        });
      }
      return;
    }

    if (decision.candidate === 'radial') {
      if (settings.layout.mode === 'radial') {
        sessionRef.current.suggestedRadial = true;
        return;
      }
      if (!sessionRef.current.suggestedRadial) {
        sessionRef.current.suggestedRadial = true;
        notificationCenter.notify({
          message: 'Many short branches detected. Try the Radial layout?',
          icon: 'Radius',
          durationMs: 10000,
          actions: true,
          onConfirm: () => applyMode('radial'),
          onCancel: () => undefined,
        });
      }
      return;
    }
  }, [settings, tree, treeUpdate?.reason]);
}
