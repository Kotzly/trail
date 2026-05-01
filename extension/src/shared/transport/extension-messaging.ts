import { defineExtensionMessaging, type GetDataType } from "@webext-core/messaging";
import {
  EXTENSION_MESSAGE,
  type ExtensionProtocolMap,
  type ExtensionMessageTarget,
} from "./protocols.js";

const IGNORED_EXTENSION_MESSAGE_ERRORS = [
  "No response",
  "Receiving end does not exist",
  "The message port closed before a response was received.",
  "Extension context invalidated",
];

function shouldIgnoreExtensionMessageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return IGNORED_EXTENSION_MESSAGE_ERRORS.some((fragment) => message.includes(fragment));
}

export const extensionMessaging = defineExtensionMessaging<ExtensionProtocolMap>();

export const {
  sendMessage: sendExtensionMessage,
  onMessage: onExtensionMessage,
  removeAllListeners: removeAllExtensionListeners,
} = extensionMessaging;

export function fireExtensionEvent<TType extends keyof ExtensionProtocolMap>(
  type: TType,
  data: GetDataType<ExtensionProtocolMap[TType]>,
  target?: ExtensionMessageTarget,
): void {
  const promise =
    target === undefined
      ? sendExtensionMessage(type, data)
      : sendExtensionMessage(type, data, target);

  void promise.catch((error) => {
    if (shouldIgnoreExtensionMessageError(error)) {
      return;
    }
    console.error("Failed to deliver extension event:", String(type), error);
  });
}

export { EXTENSION_MESSAGE };
