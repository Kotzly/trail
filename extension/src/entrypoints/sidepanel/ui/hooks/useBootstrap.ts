import { useEffect } from 'react';
import { getSettings } from '../../api/settings.js';
import { getFlags } from '../../api/flags.js';
import { getTreeState, getTrees } from '../../api/tree.js';
import { getTagDefs } from '../../api/tags.js';
import { getCommandState } from '../../api/commands.js';
import { isMac } from '@shared/utils/platform.js';
import type { MetaKeyPair } from '../state/store.js';
import { useStore } from '../state/store.js';
import { applyTheme } from '../shared/apply-theme.js';

export function useBootstrap(): void {
  const bootstrapGraph = useStore((state) => state.bootstrapGraph);
  const setPlatformMeta = useStore((state) => state.setPlatformMeta);
  const setCommandState = useStore((state) => state.setCommandState);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const setSettings = useStore((state) => state.setSettings);
  const setFlags = useStore((state) => state.setFlags);
  const setTagDefs = useStore((state) => state.setTagDefs);
  const setTrees = useStore((state) => state.setTrees);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // ---- Critical path: settings + tree only ----
      try {
        const [settings, treeState] = await Promise.all([
          getSettings(),
          getTreeState(),
        ]);
        if (!mounted) return;

        bootstrapGraph(settings, treeState);
        setSettings(settings);
        applyTheme(settings.theme, settings.customTheme);

        // Restore editor mode if it was active before the sidepanel was closed
        if (treeState.editorMode?.active) {
          setEditorMode(treeState.editorMode);
        }
      } catch (error) {
        console.error('[bootstrap] Critical fetch failed, falling back to mount-then-fetch:', error);
        // Surface already mounted React tree -- it will show loading state
        // until TREE_UPDATED arrives from background and applyTreeState fires
        return;
      }

      // ---- Deferred: non-blocking fetches after first paint ----
      if (!mounted) return;

      // Fire all deferred fetches in parallel, each with independent error handling
      const deferredPromises = [
        getFlags()
          .then((flags) => { if (mounted) setFlags(flags); })
          .catch((e) => console.warn('[bootstrap] flags fetch failed:', e)),
        getTagDefs()
          .then((defs) => { if (mounted) setTagDefs(defs); })
          .catch((e) => console.warn('[bootstrap] tagDefs fetch failed:', e)),
        getTrees()
          .then((snapshot) => { if (mounted) setTrees(snapshot); })
          .catch((e) => console.warn('[bootstrap] trees fetch failed:', e)),
        isMac()
          .then((isMacValue) => {
            if (!mounted) return;
            const metaKey: MetaKeyPair = isMacValue
              ? { short: '\u2318', long: 'cmd' }
              : { short: '^', long: 'ctrl' };
            setPlatformMeta(metaKey, isMacValue);
          })
          .catch((e) => console.warn('[bootstrap] platform meta failed:', e)),
        getCommandState()
          .then((state) => { if (mounted) setCommandState(state); })
          .catch((e) => console.warn('[bootstrap] commandState fetch failed:', e)),
      ];
      await Promise.allSettled(deferredPromises);
    })();

    return () => { mounted = false; };
  }, [bootstrapGraph, setPlatformMeta, setCommandState, setEditorMode, setFlags, setSettings, setTagDefs, setTrees]);
}
