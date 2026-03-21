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

// --- Redaction ---

const SENSITIVE_KEYS = new Set([
  "token",
  "accesstoken",
  "refreshtoken",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "secret",
]);

const URL_KEYS = new Set(["url", "href", "origin", "redirect", "redirecturi"]);
const TITLE_KEYS = new Set(["title", "pagetitle", "documenttitle"]);

function domainOnly(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "[invalid-url]";
  }
}

export function redactSensitive(payload: LogPayload): LogPayload {
  const result: LogPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = "[redacted]";
    } else if (URL_KEYS.has(lowerKey)) {
      result[key] = typeof value === "string" ? domainOnly(value) : value;
    } else if (TITLE_KEYS.has(lowerKey)) {
      result[key] = "[title omitted]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitive(value as LogPayload);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// --- Logger factory ---

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
      console.warn(prefix, message, payload ? redactSensitive(payload) : "");
    },
    error(message: string, payload?: LogPayload) {
      console.error(prefix, message, payload ? redactSensitive(payload) : "");
    },
  };
}
