import type { EditorModeState } from "@shared/rpc/contracts.js";

export type BridgePingPayload = {
  version: string;
  authenticated: boolean;
  editorMode: boolean;
};

export type WebsiteBridgeEvent = {
  editorMode: false;
};

export type WebsiteBridgeDeps = {
  getVersion(): string;
  getEditorModeState(): Promise<EditorModeState>;
  openPanel(): Promise<void>;
  enterEditorMode(treeId: string): Promise<EditorModeState>;
  exitEditorMode(): Promise<EditorModeState>;
  saveEditorMode(): Promise<void>;
  cancelEditorMode(): Promise<void>;
  forwardEditorModeExited(payload: WebsiteBridgeEvent): void;
};

export function createWebsiteBridge(deps: WebsiteBridgeDeps) {
  return {
    async ping(): Promise<BridgePingPayload> {
      const editorMode = await deps.getEditorModeState();
      return {
        version: deps.getVersion(),
        authenticated: false,
        editorMode: editorMode.active,
      };
    },

    async openPanel(): Promise<void> {
      await deps.openPanel();
    },

    async enterEditorMode(treeId: string): Promise<EditorModeState> {
      return deps.enterEditorMode(treeId);
    },

    async exitEditorMode(): Promise<EditorModeState> {
      return deps.exitEditorMode();
    },

    async saveEditorMode(): Promise<void> {
      await deps.saveEditorMode();
    },

    async cancelEditorMode(): Promise<void> {
      await deps.cancelEditorMode();
    },

    handleEditorModeExited(payload: WebsiteBridgeEvent): void {
      deps.forwardEditorModeExited(payload);
    },
  };
}
