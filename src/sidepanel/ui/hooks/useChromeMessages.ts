import { useEffect } from 'react';
import { MSG, type RequestMessage } from '../../../shared/types/messages.js';
import { getCommandState } from '../../api/commands.js';
import { useStore } from '../state/store.js';

export function useChromeMessages(): void {
  const applyTreeState = useStore((state) => state.applyTreeState);
  const setCommandState = useStore((state) => state.setCommandState);

  useEffect(() => {
    const handler = (message: RequestMessage) => {
      if (message.type !== MSG.TREE_UPDATED) return;
      applyTreeState(message);
      getCommandState()
        .then((state) => setCommandState(state))
        .catch((error) => console.error('Failed to fetch command state:', error));
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [applyTreeState, setCommandState]);
}
