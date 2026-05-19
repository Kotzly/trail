import type {
  ImportSharedTrailReply,
  ImportSharedTrailRequest,
  WebsitePingReply,
} from "@shared/transport/protocols.js";

export type WebsiteBridgeDeps = {
  getVersion(): string;
  /** Whether the extension reports a signed-in Supabase session. */
  isAuthenticated(): boolean;
  /** Capability tags the marketing page can branch on. */
  capabilities: readonly string[];
  openPanel(): Promise<void>;
  importSharedTrail(request: ImportSharedTrailRequest): Promise<ImportSharedTrailReply>;
};

export function createWebsiteBridge(deps: WebsiteBridgeDeps) {
  return {
    async ping(): Promise<WebsitePingReply> {
      return {
        version: deps.getVersion(),
        authenticated: deps.isAuthenticated(),
        capabilities: [...deps.capabilities],
      };
    },

    async openPanel(): Promise<void> {
      await deps.openPanel();
    },

    async importSharedTrail(request: ImportSharedTrailRequest): Promise<ImportSharedTrailReply> {
      return deps.importSharedTrail(request);
    },
  };
}

export type BridgePingPayload = WebsitePingReply;
