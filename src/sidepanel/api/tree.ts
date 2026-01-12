import type { NavigationNode } from "../../shared/types/node.js";
import type { NodeId, TabId } from "../../shared/types/ids.js";
import {
  msg,
  type BeginTempSelectionInput,
  type TempSelectionSessionId,
  type TreeUpdatedInput,
} from "../../shared/types/messages.js";
import { sendMessage } from "./background.js";

export async function navigateTo(node: NavigationNode): Promise<void> {
    const res = await sendMessage(msg.navigateTo({ url: node.data.url, nodeId: node.id }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function previewNode(nodeId: NodeId): Promise<void> {
    const res = await sendMessage(msg.previewNode({ nodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function setCurrentNode(nodeId: NodeId): Promise<void> {
    const res = await sendMessage(msg.setCurrent({ nodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function beginTempSelection(payload: BeginTempSelectionInput): Promise<{ sessionId: TempSelectionSessionId }> {
    const res = await sendMessage(msg.beginTempSelection(payload));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function previewTempSelection(sessionId: TempSelectionSessionId, nodeId: NodeId): Promise<{ previewedTabId: TabId | null }> {
    const res = await sendMessage(msg.previewTempSelection({ sessionId, nodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function acceptTempSelection(sessionId: TempSelectionSessionId, nodeId?: NodeId): Promise<void> {
    const res = await sendMessage(msg.acceptTempSelection({ sessionId, nodeId } as { sessionId: TempSelectionSessionId; nodeId?: NodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function cancelTempSelection(sessionId: TempSelectionSessionId): Promise<void> {
    const res = await sendMessage(msg.cancelTempSelection({ sessionId }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function endTempSelection(sessionId: TempSelectionSessionId): Promise<void> {
    const res = await sendMessage(msg.endTempSelection({ sessionId }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function getTreeState(): Promise<TreeUpdatedInput> {
    const res = await sendMessage(msg.getTree());
    if (!res.success) throw new Error(res.error);
    return res.data;
}

export async function clearTree(): Promise<void> {
    const res = await sendMessage(msg.clearTree());
    if (!res.success) throw new Error(res.error);
    return res.data;
}
