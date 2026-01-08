import type { NavigationNode } from "../../shared/types/node";
import { msg, NavigateToData } from "../../shared/types/messages";
import { sendMessage } from "./background";

export async function navigateTo(node: NavigationNode): Promise<NavigateToData> {
    const res = await sendMessage(msg.navigateTo({ url: node.data.url, nodeId: node.id }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}
