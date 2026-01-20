import { useEffect } from 'react';
import { getSettings } from '../../api/settings.js';
import { getTreeState, getTrees } from '../../api/tree.js';
import { getTagDefs } from '../../api/tags.js';
import { getCommandState } from '../../api/commands.js';
import { isMac } from '../../../shared/utils/platform.js';
import { MetaKeyPair, useStore } from '../state/store.js';
import { applyTheme } from '../shared/apply-theme.js';

export function useBootstrap(): void {
  const bootstrap = useStore((state) => state.bootstrap);
  const setCommandState = useStore((state) => state.setCommandState);
  const setSettings = useStore((state) => state.setSettings);
  const setTagDefs = useStore((state) => state.setTagDefs);
  const setTrees = useStore((state) => state.setTrees);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [settings, treeState, isMacValue, tagDefs, treesSnapshot] = await Promise.all([
          getSettings(),
          getTreeState(),
          isMac(),
          getTagDefs(),
          getTrees(),
        ]);
        if (!mounted) return;
        const metaKey = isMacValue ? { short: '⌘', long: 'cmd' } as MetaKeyPair : { short: '^', long: 'ctrl' } as MetaKeyPair;
        bootstrap(settings, treeState, metaKey, isMacValue);
        setSettings(settings);
        setTagDefs(tagDefs);
        setTrees(treesSnapshot);
        applyTheme(settings.theme, settings.customTheme);
        const commandState = await getCommandState();
        if (mounted) setCommandState(commandState);
      } catch (error) {
        console.error('Failed to initialize sidepanel:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [bootstrap, setCommandState, setSettings, setTagDefs, setTrees]);
}
