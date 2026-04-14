import {
  EXTENSION_MESSAGE,
  fireExtensionEvent,
} from "@shared/transport/extension-messaging.js";

export type UiNotificationPayload = {
  message: string;
  icon?: string;
  durationMs?: number;
};

export function notifyUi(notification: UiNotificationPayload): void {
  fireExtensionEvent(EXTENSION_MESSAGE.UI_NOTIFY, notification);
}
