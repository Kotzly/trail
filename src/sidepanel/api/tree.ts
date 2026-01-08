import type { NavigationNode } from "../../shared/types/node.js";
import { msg, NavigateToData } from "../../shared/types/messages.js";
import { sendMessage } from "./background.js";

export async function navigateTo(node: NavigationNode): Promise<NavigateToData> {
    const res = await sendMessage(msg.navigateTo({ url: node.data.url, nodeId: node.id }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}
