import { rpc } from '../../shared/rpc/contracts.js';
import { sendRuntimeMessage } from './send-message.js';

export type UiNotificationPayload = {
  message: string;
  icon?: string;
  durationMs?: number;
};

export function notifyUi(notification: UiNotificationPayload): void {
  sendRuntimeMessage(rpc.notify({ notification }));
}
