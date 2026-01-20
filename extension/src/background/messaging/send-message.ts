import type { RequestMessage } from '../../shared/types/messages.js';

const IGNORED_ERRORS = [
  'Receiving end does not exist',
  'The message port closed before a response was received.',
];

function shouldIgnoreRuntimeError(message: string | undefined): boolean {
  if (!message) return false;
  return IGNORED_ERRORS.some((fragment) => message.includes(fragment));
}

export function sendRuntimeMessage(message: RequestMessage): void {
  chrome.runtime.sendMessage(message, () => {
    const err = chrome.runtime.lastError;
    if (!err) return;
    if (shouldIgnoreRuntimeError(err.message)) return;
    console.error('Failed to send runtime message:', message.type, err);
  });
}
