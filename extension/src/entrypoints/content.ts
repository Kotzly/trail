import { ALLOWED_SITE_MATCH_PATTERNS } from "../shared/config/site-origins";
import { EXTENSION_MESSAGE, sendExtensionMessage } from "../shared/transport/extension-messaging";

export default defineContentScript({
  matches: [...ALLOWED_SITE_MATCH_PATTERNS],
  runAt: "document_start",
  allFrames: false,
  async main(_ctx) {
    try {
      await import("../content/bridge/runtime");
    } catch (error) {
      // Forward to the service worker so Sentry sees the failure — we don't
      // init Sentry in content scripts to avoid capturing host-page errors.
      const message = error instanceof Error ? error.message : String(error);
      void sendExtensionMessage(EXTENSION_MESSAGE.CONTENT_BRIDGE_ERROR, {
        message,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        url: location.href,
      }).catch(() => {
        // SW unreachable — nothing more we can do.
      });
    }
  },
});
