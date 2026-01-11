import type { NavigationNode } from "../../shared/types/node.js";
import type { NodeId } from "../../shared/types/ids.js";
import { msg, type TreeUpdatedInput } from "../../shared/types/messages.js";
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
