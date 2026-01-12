import { useEffect } from 'react';
import { getSettings } from '../../api/settings.js';
import { getTreeState } from '../../api/tree.js';
import { getTagDefs } from '../../api/tags.js';
import { getCommandState } from '../../api/commands.js';
import { isMac } from '../../../shared/utils/platform.js';
import { MetaKeyPair, useStore } from '../state/store.js';

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useBootstrap(): void {
  const bootstrap = useStore((state) => state.bootstrap);
  const setCommandState = useStore((state) => state.setCommandState);
  const setSettings = useStore((state) => state.setSettings);
  const setTagDefs = useStore((state) => state.setTagDefs);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [settings, treeState, isMacValue, tagDefs] = await Promise.all([
          getSettings(),
          getTreeState(),
          isMac(),
          getTagDefs(),
        ]);
        if (!mounted) return;
        const metaKey = isMacValue ? { short: '⌘', long: 'cmd' } as MetaKeyPair : { short: '^', long: 'ctrl' } as MetaKeyPair;
        bootstrap(settings, treeState, metaKey, isMacValue);
        setSettings(settings);
        setTagDefs(tagDefs);
        applyTheme(settings.theme);
        const commandState = await getCommandState();
        if (mounted) setCommandState(commandState);
      } catch (error) {
        console.error('Failed to initialize sidepanel:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [bootstrap, setCommandState, setSettings, setTagDefs]);
}
