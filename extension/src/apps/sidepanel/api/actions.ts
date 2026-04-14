import { actionService } from "@shared/transport/proxy-clients.js";
import type { NodeId, TabId } from "@shared/types/ids.js";

export async function openInNewTab(nodeId: NodeId): Promise<void> {
  await actionService.openInNewTab({ nodeId });
}

export async function toggleMute(nodeId: NodeId, tabId: TabId): Promise<void> {
  await actionService.toggleMute({ nodeId, tabId });
}

export async function closeTab(nodeId: NodeId, tabId: TabId): Promise<void> {
  await actionService.closeTab({ nodeId, tabId });
}

export async function bulkCloseTabs(nodeIds: NodeId[]): Promise<void> {
  await actionService.bulkCloseTabs({ nodeIds });
}

export async function togglePin(nodeId: NodeId): Promise<void> {
  await actionService.togglePin({ nodeId });
}

export async function bulkPin(nodeIds: NodeId[]): Promise<void> {
  await actionService.bulkPin({ nodeIds });
}

export async function bulkUnpin(nodeIds: NodeId[]): Promise<void> {
  await actionService.bulkUnpin({ nodeIds });
}

export async function deleteNode(nodeId: NodeId): Promise<void> {
  await actionService.deleteNode({ nodeId });
}

export async function deleteChildren(nodeId: NodeId): Promise<void> {
  await actionService.deleteChildren({ nodeId });
}

export async function deleteWithChildren(nodeId: NodeId): Promise<void> {
  await actionService.deleteWithChildren({ nodeId });
}

export async function bulkDelete(nodeIds: NodeId[]): Promise<void> {
  await actionService.bulkDelete({ nodeIds });
}

export async function bulkDeleteNodes(nodeIds: NodeId[]): Promise<void> {
  await actionService.bulkDeleteNodes({ nodeIds });
}

export async function bulkDeleteRecursive(nodeIds: NodeId[]): Promise<void> {
  await actionService.bulkDeleteRecursive({ nodeIds });
}

export async function exitEditorMode(): Promise<void> {
  await actionService.exitEditorMode();
}

export function fireAndForget(action: Promise<unknown>, context: string): void {
  void action.catch((error) => {
    console.error(`Failed to run sidepanel action (${context}):`, error);
  });
}
