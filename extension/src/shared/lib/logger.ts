/**
 * Structured logging utility for the extension.
 *
 * In development: logs to console with prefix.
 * In production: silences info/debug, keeps warn/error.
 *
 * Usage:
 *   const log = createLogger("sync-engine");
 *   log.info("sync started", { deviceId });
 *   log.error("sync failed", { error });
 */

type LogPayload = Record<string, unknown>;

type Logger = {
  debug: (message: string, payload?: LogPayload) => void;
  info: (message: string, payload?: LogPayload) => void;
  warn: (message: string, payload?: LogPayload) => void;
  error: (message: string, payload?: LogPayload) => void;
};

const IS_DEV =
  typeof process !== "undefined"
    ? process.env.NODE_ENV !== "production"
    : typeof chrome !== "undefined" && !chrome.runtime?.getManifest?.()?.update_url;

export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;

  return {
    debug(message: string, payload?: LogPayload) {
      if (IS_DEV) {
        console.debug(prefix, message, payload ?? "");
      }
    },
    info(message: string, payload?: LogPayload) {
      if (IS_DEV) {
        console.info(prefix, message, payload ?? "");
      }
    },
    warn(message: string, payload?: LogPayload) {
      console.warn(prefix, message, payload ?? "");
    },
    error(message: string, payload?: LogPayload) {
      console.error(prefix, message, payload ?? "");
    },
  };
}
