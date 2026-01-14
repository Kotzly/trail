import { useEffect, useRef } from 'react';
import type { LayoutMode, Settings } from '../../../shared/types/settings.js';
import type { NavigationNode } from '../../../shared/types/node.js';
import { saveSettings } from '../../api/settings.js';
import { notificationCenter } from '../notifications/notification-center.js';
import { useStore } from '../state/store.js';

const TREE_DEPTH_THRESHOLD = 5;
const ROOT_CHILD_THRESHOLD = 7;

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

    const root = tree?.getRoot?.() ?? null;
    const rootId = root?.id ?? null;
    const isReset = treeUpdate?.reason === 'tree-reset';

    const applyMode = (mode: LayoutMode) => {
      const state = useStore.getState();
      if (!state.settings) return;
      void applyLayoutMode(state.settings, mode, state.setSettings);
    };

    if (isReset) {
      sessionRef.current = { rootId, suggestedTree: false, suggestedRadial: false };
      applyMode('mindmap');
      return;
    }

    if (sessionRef.current.rootId === null && rootId !== null) {
      sessionRef.current.rootId = rootId;
    }

    if (!root) return;

    if (!sessionRef.current.suggestedTree) {
      const maxDepth = getMaxDepth(root);
      if (settings.layout.mode === 'tree') {
        sessionRef.current.suggestedTree = true;
      } else if (maxDepth >= TREE_DEPTH_THRESHOLD) {
        sessionRef.current.suggestedTree = true;
        notificationCenter.notify({
          message: 'Deep branch detected. Switch to Tree layout?',
          icon: 'Network',
          durationMs: 10000,
          actions: true,
          onConfirm: () => applyMode('tree'),
          onCancel: () => undefined,
        });
        return;
      } else {
        return;
      }
    }

    if (!sessionRef.current.suggestedRadial) {
      const childCount = root.getChildren?.().length ?? 0;
      if (childCount >= ROOT_CHILD_THRESHOLD && settings.layout.mode !== 'radial') {
        sessionRef.current.suggestedRadial = true;
        notificationCenter.notify({
          message: 'Lots of branches at root. Try the Radial layout?',
          icon: 'Radius',
          durationMs: 10000,
          actions: true,
          onConfirm: () => applyMode('radial'),
          onCancel: () => undefined,
        });
      }
    }
  }, [settings, tree, treeUpdate?.reason]);
}
