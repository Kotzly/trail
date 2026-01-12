import { useEffect } from 'react';
import { MSG, type RequestMessage } from '../../../shared/types/messages.js';
import { getCommandState } from '../../api/commands.js';
import { useStore } from '../state/store.js';

export function useChromeMessages(): void {
  const applyTreeState = useStore((state) => state.applyTreeState);
  const setCommandState = useStore((state) => state.setCommandState);
  const setTagDefs = useStore((state) => state.setTagDefs);

  useEffect(() => {
    const handler = (message: RequestMessage) => {
      if (message.type === MSG.TREE_UPDATED) {
        applyTreeState(message);
        getCommandState()
          .then((state) => setCommandState(state))
          .catch((error) => console.error('Failed to fetch command state:', error));
        return;
      }
      if (message.type === MSG.TAGS_UPDATED) {
        setTagDefs(message.tagDefs);
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [applyTreeState, setCommandState, setTagDefs]);
}
