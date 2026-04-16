import type { SendMessageOptions } from "@webext-core/messaging";
import type {
  EditorModeState,
  TitleOrFaviconChangedInput,
  TreeUpdatedInput,
  TreesSnapshot,
  UiNotificationInput,
} from "@shared/rpc/contracts.js";

export const WEBSITE_MESSAGING_NAMESPACE = "trail-bridge-v1" as const;

export const EXTENSION_MESSAGE = {
  OPEN_PANEL: "extension/open-panel",
  TITLE_OR_FAVICON_CHANGED: "extension/title-or-favicon-changed",
  TREE_UPDATED: "event/tree-updated",
  TREES_UPDATED: "event/trees-updated",
  UI_NOTIFY: "event/ui-notify",
  SYNC_STATUS: "event/sync-status",
  SYNC_CONFLICT: "event/sync-conflict",
  AUTH_STATE: "event/auth-state",
  SITE_EDITOR_MODE_EXITED: "site/editor-mode-exited",
} as const;

export type SyncStatusEvent = {
  status: "idle" | "saving" | "saved" | "error" | "offline";
};

export type SyncConflictEvent = {
  treeId: string;
  serverUpdatedAt: string;
  serverDeviceId: string;
};

export type AuthStateEvent =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      identity: {
        userId: string;
        email: string | null;
        displayName: string | null;
        avatarUrl: string | null;
      };
    };

export interface ExtensionProtocolMap {
  [EXTENSION_MESSAGE.OPEN_PANEL](): void;
  [EXTENSION_MESSAGE.TITLE_OR_FAVICON_CHANGED](data: TitleOrFaviconChangedInput): void;
  [EXTENSION_MESSAGE.TREE_UPDATED](data: TreeUpdatedInput): void;
  [EXTENSION_MESSAGE.TREES_UPDATED](data: TreesSnapshot): void;
  [EXTENSION_MESSAGE.UI_NOTIFY](data: UiNotificationInput): void;
  [EXTENSION_MESSAGE.SYNC_STATUS](data: SyncStatusEvent): void;
  [EXTENSION_MESSAGE.SYNC_CONFLICT](data: SyncConflictEvent): void;
  [EXTENSION_MESSAGE.AUTH_STATE](data: AuthStateEvent): void;
  [EXTENSION_MESSAGE.SITE_EDITOR_MODE_EXITED](data: { editorMode: false }): void;
}

export const WEBSITE_MESSAGE = {
  PING: "site/ping",
  OPEN_PANEL: "site/open-panel",
  ENTER_EDITOR_MODE: "site/enter-editor-mode",
  EXIT_EDITOR_MODE: "site/exit-editor-mode",
  SAVE_EDITOR_MODE: "site/save-editor-mode",
  CANCEL_EDITOR_MODE: "site/cancel-editor-mode",
  EDITOR_MODE_EXITED: "site/editor-mode-exited",
} as const;

export interface WebsiteProtocolMap {
  [WEBSITE_MESSAGE.PING](): {
    version: string;
    authenticated: boolean;
    editorMode: boolean;
  };
  [WEBSITE_MESSAGE.OPEN_PANEL](): void;
  [WEBSITE_MESSAGE.ENTER_EDITOR_MODE](data: { treeId: string }): EditorModeState;
  [WEBSITE_MESSAGE.EXIT_EDITOR_MODE](): EditorModeState;
  [WEBSITE_MESSAGE.SAVE_EDITOR_MODE](): void;
  [WEBSITE_MESSAGE.CANCEL_EDITOR_MODE](): void;
  [WEBSITE_MESSAGE.EDITOR_MODE_EXITED](data: { editorMode: false }): void;
}

export type ExtensionMessageTarget = number | SendMessageOptions;
