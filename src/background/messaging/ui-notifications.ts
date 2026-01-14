import { msg } from '../../shared/types/messages.js';

export type UiNotificationPayload = {
  message: string;
  icon?: string;
  durationMs?: number;
};

export function notifyUi(notification: UiNotificationPayload): void {
  chrome.runtime.sendMessage(msg.notify({ notification }));
}
