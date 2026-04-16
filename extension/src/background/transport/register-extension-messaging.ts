import { contentHandlers } from "@background/messaging/handlers/content-handlers.js";
import { panelHandlers } from "@background/messaging/handlers/panel-handlers.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";
import { RPC_METHOD } from "@shared/rpc/contracts.js";

let initialized = false;

export function registerExtensionMessaging(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  onExtensionMessage(EXTENSION_MESSAGE.OPEN_PANEL, ({ sender }) =>
    panelHandlers[RPC_METHOD.OPEN_PANEL]!(
      {
        type: RPC_METHOD.OPEN_PANEL,
      },
      sender,
    ),
  );

  onExtensionMessage(EXTENSION_MESSAGE.TITLE_OR_FAVICON_CHANGED, ({ data, sender }) =>
    contentHandlers[RPC_METHOD.TITLE_OR_FAVICON_CHANGED]!(
      {
        type: RPC_METHOD.TITLE_OR_FAVICON_CHANGED,
        ...data,
      },
      sender,
    ),
  );
}
