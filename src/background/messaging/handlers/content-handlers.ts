// messaging/handlers/content-handlers.ts
import { shouldTrackUrl, getFaviconUrl } from "../../utils/url-utils";
import { treeStorage } from "../../services/tree-storage";
import { tabManager } from "../../state/tab-manager";
import { notifyTreeUpdate } from "../notifications";
import {
  MSG,
  defineHandlers,
  type MessageByType,
  type MessageHandler,
  type Response,
} from "../../../shared/types/messages";
import { TabId } from "../../../shared/types/ids";

type ContentRequestType = typeof MSG.TITLE_CHANGED;

function ok<T = void>(data?: T): Response<T> {
  return { success: true, data: data as T };
}

function err(error: string): Response<never> {
  return { success: false, error };
}

function getSenderTabId(sender: chrome.runtime.MessageSender): TabId | null {
  const id = sender.tab?.id;
  return id as TabId | null;
}

/**
 * Content script -> SW handlers.
 */
export const contentHandlers = defineHandlers({
  async [MSG.TITLE_CHANGED](message, sender) {
    const tabId = getSenderTabId(sender);
    if (!tabId) return err("No tab ID");

    const url = message.url;
    const newTitle = message.title;

    if (!newTitle || !shouldTrackUrl(url)) return ok();

    try {
      // Always multi-tab mode - use GLOBAL tree
      const rawTabId = sender.tab?.id;
      const nodeId = typeof rawTabId === "number" ? tabManager.nodeByTab(rawTabId as any) : undefined;

      if (nodeId !== undefined) {
        const tree = await treeStorage.getTree();
        const node = tree.findNodeById(nodeId);

        if (node && node.data.url === url && node.data.title !== newTitle) {
          node.data.title = newTitle;
          await treeStorage.saveTree(tree);
          await notifyTreeUpdate(tree);
        }
      }

      return ok();
    } catch (e) {
      console.debug("Title update error:", e);
      return err("Title update failed");
    }
  },
});

/**
 * Convenience wrapper (keeps router simple while you migrate other handler packs).
 */
export const handleContentMessage: MessageHandler<ContentRequestType> = async (
  message: MessageByType<ContentRequestType>,
  sender
) => {
  const fn = (contentHandlers as any)[message.type] as
    | ((m: any, s: chrome.runtime.MessageSender) => Promise<Response<any>> | Response<any>)
    | undefined;

  if (!fn) return err(`No content handler for message type: ${message.type}`);
  return await fn(message, sender);
};
