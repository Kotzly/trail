import { jsonNoStore } from "./response";

type ErrorResponse = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: string;
};

type ErrorInit = ResponseInit & {
  retryable?: boolean;
  details?: string;
};

export function jsonError(code: string, message: string, init: ErrorInit = {}) {
  const { retryable, details, ...responseInit } = init;
  const payload: ErrorResponse = { code, message };

  if (retryable !== undefined) {
    payload.retryable = retryable;
  }

  if (details) {
    payload.details = details;
  }

  return jsonNoStore(payload, responseInit);
}
