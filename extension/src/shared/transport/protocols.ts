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
  IMPORT_SHARED_TRAIL_FROM_SITE: "extension/import-shared-trail-from-site",
} as const;

export type ImportSharedTrailFromSiteData = {
  code: string;
};

export type ImportSharedTrailFromSiteReply =
  | {
      ok: true;
      trailId: string;
      label: string;
      nodeCount: number;
    }
  | {
      ok: false;
      error:
        | "needs-signin"
        | "share-unavailable"
        | "share-self-import"
        | "share-no-device"
        | "unknown";
      message?: string;
    };

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
  [EXTENSION_MESSAGE.IMPORT_SHARED_TRAIL_FROM_SITE](
    data: ImportSharedTrailFromSiteData,
  ): ImportSharedTrailFromSiteReply;
}

export const WEBSITE_MESSAGE = {
  PING: "site/ping",
  OPEN_PANEL: "site/open-panel",
  IMPORT_SHARED_TRAIL: "site/import-shared-trail",
} as const;

/**
 * Reply to a `site/ping` from a marketing page. The `capabilities`
 * array lets the page check feature support before exposing UI tied to
 * extension-side functionality — e.g. the share-import button on
 * `/s/<code>` only renders when `capabilities.includes("share_import")`.
 * Old extensions installed before sharing shipped will not include the
 * capability and the marketing page will fall back to a "copy code"
 * affordance instead.
 */
export type WebsitePingReply = {
  version: string;
  authenticated: boolean;
  capabilities: string[];
};

export type ImportSharedTrailRequest = {
  code: string;
};

export type ImportSharedTrailReply =
  | {
      ok: true;
      trailId: string;
      label: string;
      nodeCount: number;
    }
  | {
      ok: false;
      /**
       * Stable error code for the marketing page to switch on. UI copy
       * lives in the page, not the extension.
       */
      error:
        | "needs-signin"
        | "share-unavailable"
        | "share-self-import"
        | "share-no-device"
        | "unknown";
      message?: string;
    };

export interface WebsiteProtocolMap {
  [WEBSITE_MESSAGE.PING](): WebsitePingReply;
  [WEBSITE_MESSAGE.OPEN_PANEL](): void;
  [WEBSITE_MESSAGE.IMPORT_SHARED_TRAIL](data: ImportSharedTrailRequest): ImportSharedTrailReply;
}

export type ExtensionMessageTarget = number | SendMessageOptions;
