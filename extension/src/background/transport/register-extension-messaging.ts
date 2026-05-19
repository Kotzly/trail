import { contentHandlers } from "@background/messaging/handlers/content-handlers.js";
import { panelHandlers } from "@background/messaging/handlers/panel-handlers.js";
import { handleImportSharedTrailFromSite } from "@background/messaging/handlers/share-from-site-handler.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";
import { RPC_METHOD } from "@shared/rpc/contracts.js";
import { captureError } from "@shared/lib/observability.js";

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

  onExtensionMessage(EXTENSION_MESSAGE.CONTENT_BRIDGE_ERROR, ({ data, sender }) => {
    const error = new Error(`[content-bridge] ${data.message}`);
    if (data.stack) error.stack = data.stack;
    captureError(error, {
      surface: "content",
      kind: "content_bridge_load",
      // URL host only — never the full path (PII policy).
      host: safeHostname(data.url),
      tabId: sender.tab?.id ?? null,
    });
  });

  onExtensionMessage(EXTENSION_MESSAGE.IMPORT_SHARED_TRAIL_FROM_SITE, ({ data, sender }) =>
    handleImportSharedTrailFromSite(data, sender),
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(unparseable)";
  }
}
