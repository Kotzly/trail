import { msg } from '../../shared/types/messages.js';
import { sendRuntimeMessage } from './send-message.js';

export type UiNotificationPayload = {
  message: string;
  icon?: string;
  durationMs?: number;
};

export function notifyUi(notification: UiNotificationPayload): void {
  sendRuntimeMessage(msg.notify({ notification }));
}
