import type { TreeNode } from "../../background/state/treenode";
import { msg, NavigateToData } from "../../shared/types/messages";
import { sendMessage } from "./background";

export async function navigateTo(node: TreeNode): Promise<NavigateToData> {
    const res = await sendMessage(msg.navigateTo({ url: node.url, nodeId: node.id }));
    if (!res.success) throw new Error(res.error);
    return res.data;
}
