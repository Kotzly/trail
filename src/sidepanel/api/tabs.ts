import type { NodeId } from "../../shared/types/ids.js";
import { msg } from "../../shared/types/messages.js";
import { sendMessage } from "./background.js";

export async function getTabsForNode(nodeId: NodeId): Promise<chrome.tabs.Tab[]> {
    const res = await sendMessage(msg.getTabsForNode({ nodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data.tabs;
}