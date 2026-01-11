import { useEffect } from 'react';
import type { RefObject } from 'react';
import { redo, undo } from '../../api/commands.js';
import { useStore } from '../state/store.js';


export function useShortcuts(searchInputRef: RefObject<HTMLInputElement>): void {
  const setCommandState = useStore((state) => state.setCommandState);
  const isMac = useStore((state) => state.isMac);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }
      const meta = isMac ? event.metaKey : event.ctrlKey;
      if (!meta) return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        try {
          const state = event.shiftKey ? await redo() : await undo();
          setCommandState(state);
        } catch (error) {
          console.error('Failed to update command state:', error);
        }
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMac, searchInputRef, setCommandState]);
}
