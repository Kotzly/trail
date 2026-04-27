import type { SendMessageOptions } from "@webext-core/messaging";
import type {
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
  SYNC_CONFLICT_RESOLVED: "event/sync-conflict-resolved",
  AUTH_STATE: "event/auth-state",
  AUTH_TRANSITION: "event/auth-transition",
  CONTENT_BRIDGE_ERROR: "event/content-bridge-error",
} as const;

export type ContentBridgeErrorEvent = {
  message: string;
  stack: string | null;
  url: string;
};

export type SyncStatusEvent = {
  status: "idle" | "saving" | "saved" | "error" | "offline";
};

export type SyncConflictEvent = {
  treeId: string;
  serverUpdatedAt: string;
  serverDeviceId: string;
};

export type SyncConflictResolvedEvent = {
  treeId: string;
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

export type AuthTransitionEvent = {
  reason: "signed-out" | "account-switched" | "first-signin";
};

export interface ExtensionProtocolMap {
  [EXTENSION_MESSAGE.OPEN_PANEL](): void;
  [EXTENSION_MESSAGE.TITLE_OR_FAVICON_CHANGED](data: TitleOrFaviconChangedInput): void;
  [EXTENSION_MESSAGE.TREE_UPDATED](data: TreeUpdatedInput): void;
  [EXTENSION_MESSAGE.TREES_UPDATED](data: TreesSnapshot): void;
  [EXTENSION_MESSAGE.UI_NOTIFY](data: UiNotificationInput): void;
  [EXTENSION_MESSAGE.SYNC_STATUS](data: SyncStatusEvent): void;
  [EXTENSION_MESSAGE.SYNC_CONFLICT](data: SyncConflictEvent): void;
  [EXTENSION_MESSAGE.SYNC_CONFLICT_RESOLVED](data: SyncConflictResolvedEvent): void;
  [EXTENSION_MESSAGE.AUTH_STATE](data: AuthStateEvent): void;
  [EXTENSION_MESSAGE.AUTH_TRANSITION](data: AuthTransitionEvent): void;
  [EXTENSION_MESSAGE.CONTENT_BRIDGE_ERROR](data: ContentBridgeErrorEvent): void;
}

export const WEBSITE_MESSAGE = {
  PING: "site/ping",
  OPEN_PANEL: "site/open-panel",
} as const;

export interface WebsiteProtocolMap {
  [WEBSITE_MESSAGE.PING](): {
    version: string;
    authenticated: boolean;
  };
  [WEBSITE_MESSAGE.OPEN_PANEL](): void;
}

export type ExtensionMessageTarget = number | SendMessageOptions;
