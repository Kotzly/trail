import type { NodeId } from "../../shared/types/ids";
import { msg } from "../../shared/types/messages";
import { sendMessage } from "./background";

export async function getTabsForNode(nodeId: NodeId): Promise<chrome.tabs.Tab[]> {
    const res = await sendMessage(msg.getTabsForNode({ nodeId }));
    if (!res.success) throw new Error(res.error);
    return res.data.tabs;
}