/**
 * Mirror of `extension/src/shared/transport/protocols.ts` — kept in sync
 * by hand so the marketing app doesn't depend on the WXT build graph.
 * Only the page-callable surface is duplicated (PING, OPEN_PANEL,
 * IMPORT_SHARED_TRAIL); extension-internal messages live on the
 * extension side.
 *
 * The namespace must match the extension's value exactly — the
 * `@webext-core/messaging/page` window protocol filters incoming
 * messages by `namespace`.
 */

export const WEBSITE_MESSAGING_NAMESPACE = "trail-bridge-v1" as const;

export const WEBSITE_MESSAGE = {
  PING: "site/ping",
  OPEN_PANEL: "site/open-panel",
  IMPORT_SHARED_TRAIL: "site/import-shared-trail",
} as const;

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
  [WEBSITE_MESSAGE.IMPORT_SHARED_TRAIL](
    data: ImportSharedTrailRequest,
  ): ImportSharedTrailReply;
}
