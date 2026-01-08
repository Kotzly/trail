// messaging/handlers/content-handlers.ts
import { shouldTrackUrl, getFaviconUrl } from "../../utils/url-utils";
import { treeStorage } from "../../services/tree-storage";
import { tabManager } from "../../state/tab-manager";
import { notifyGlobalTreeUpdate, notifyTreeUpdate } from "../notifications";
import type { TreeEntry } from "../../../shared/types/node";
import type { TabId } from "../../../shared/types/ids";
import {
  MSG,
  defineHandlers,
  type MessageByType,
  type MessageHandler,
  type Response,
} from "../../../shared/types/messages";

type ContentRequestType = typeof MSG.URL_CHANGED | typeof MSG.TITLE_CHANGED;

function ok<T = void>(data?: T): Response<T> {
  return { success: true, data: data as T };
}

function err(error: string): Response<never> {
  return { success: false, error };
}

function getSenderTabId(sender: chrome.runtime.MessageSender): TabId | null {
  const id = sender.tab?.id;
  return typeof id === "number" ? (id as unknown as TabId) : null;
}

const urlHandler = async (message: MessageByType<typeof MSG.URL_CHANGED>, sender: chrome.runtime.MessageSender) => {
  const tabId = getSenderTabId(sender);
  if (!tabId) return err("No tab ID");

  const url = message.url;
  if (!shouldTrackUrl(url)) return ok();

  // Back/forward navigation - find existing node
  if (message.isBackForward) {
    const tree = await treeStorage.getTree(tabId);
    const node = tree.findByUrl(url);
    if (node) {
      tree.setCurrentById(node.id);
      await treeStorage.saveTree(tabId, tree);
      await notifyTreeUpdate(tabId);
    }
    return ok();
  }

  // New navigation - add to tree
  const entry: TreeEntry = {
    url: url as any,
    title: (message.title || url) as any,
    favicon: (sender.tab?.favIconUrl || getFaviconUrl(url)) as any,
  };

  const tree = await treeStorage.getTree(tabId);
  tree.navigate(entry, { backOnRevisit: true });
  await treeStorage.saveTree(tabId, tree);
  await notifyTreeUpdate(tabId);

  return ok();
}

/**
 * Content script -> SW handlers.
 *
 * NOTE: this file assumes MSG.URL_CHANGED exists in shared/types/messages.ts
 * and is part of RequestMessage/ResponseDataByType (response: void).
 */
export const contentHandlers = defineHandlers({
  urlHandler,

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
        const tree = await treeStorage.getGlobalTree();
        const node = tree.findNodeByIdDFS(nodeId);

        if (node && node.url === url && node.title !== newTitle) {
          node.title = newTitle as any;
          await treeStorage.saveGlobalTree(tree);
          await notifyGlobalTreeUpdate(tree);
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
