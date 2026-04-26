export type BridgePingPayload = {
  version: string;
  authenticated: boolean;
};

export type WebsiteBridgeDeps = {
  getVersion(): string;
  openPanel(): Promise<void>;
};

export function createWebsiteBridge(deps: WebsiteBridgeDeps) {
  return {
    async ping(): Promise<BridgePingPayload> {
      return {
        version: deps.getVersion(),
        authenticated: false,
      };
    },

    async openPanel(): Promise<void> {
      await deps.openPanel();
    },
  };
}
