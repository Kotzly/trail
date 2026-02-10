import { useEffect } from 'react';
import { MSG, type RequestMessage } from '../../../shared/types/messages.js';
import { getCommandState } from '../../api/commands.js';
import { useStore } from '../state/store.js';
import { notificationCenter } from '../notifications/notification-center.js';
import type { NotificationDurationMs, NotificationInput } from '../notifications/types.js';
import { Icons } from '../components/Icon.js';

export function useChromeMessages(): void {
  const applyTreeState = useStore((state) => state.applyTreeState);
  const setCommandState = useStore((state) => state.setCommandState);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const setTagDefs = useStore((state) => state.setTagDefs);
  const setTrees = useStore((state) => state.setTrees);

  useEffect(() => {
    const handler = (message: RequestMessage) => {
      if (message.type === MSG.TREE_UPDATED) {
        applyTreeState(message);

        // Sync editor mode state from tree update reason
        if (message.reason === 'editor-enter') {
          // The treeId is conveyed by the background; for now derive from the
          // current tree's root or leave as null until a direct update.
          setEditorMode({ active: true, treeId: null });
        } else if (message.reason === 'editor-exit') {
          setEditorMode({ active: false, treeId: null });
        }

        getCommandState()
          .then((state) => setCommandState(state))
          .catch((error) => console.error('Failed to fetch command state:', error));
        return;
      }
      if (message.type === MSG.TAGS_UPDATED) {
        setTagDefs(message.tagDefs);
        return;
      }
      if (message.type === MSG.TREES_UPDATED) {
        setTrees({ active: message.active, archived: message.archived });
        return;
      }
      if (message.type === MSG.NOTIFY) {
        const { message: text, icon, durationMs } = message.notification;
        const input: NotificationInput = { message: text };
        if (icon && icon in Icons) {
          input.icon = icon as Exclude<NotificationInput['icon'], undefined>;
        }
        const allowedDurations: NotificationDurationMs[] = [1000, 3000, 5000, 10000, 15000];
        if (durationMs && allowedDurations.includes(durationMs as NotificationDurationMs)) {
          input.durationMs = durationMs as NotificationDurationMs;
        }
        notificationCenter.notify(input);
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [applyTreeState, setCommandState, setEditorMode, setTagDefs, setTrees]);
}
