import type { RequestMessage } from "@shared/rpc/contracts.js";
import { browser } from "@shared/platform/webext.js";

const IGNORED_ERRORS = [
  "Receiving end does not exist",
  "The message port closed before a response was received.",
];

function shouldIgnoreRuntimeError(message: string | undefined): boolean {
  if (!message) return false;
  return IGNORED_ERRORS.some((fragment) => message.includes(fragment));
}

export function sendRuntimeMessage(message: RequestMessage): void {
  void browser.runtime.sendMessage(message).catch((error) => {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (shouldIgnoreRuntimeError(errMessage)) return;
    console.error("Failed to send runtime message:", message.type, error);
  });
}
