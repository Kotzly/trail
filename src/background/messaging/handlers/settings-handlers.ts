import { settingsManager } from '../../services/settings';
import { treeStorage } from '../../services/tree-storage';

export async function handleSettingsMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case 'GET_SETTINGS': {
      const settings = settingsManager.get();
      return { success: true, settings };
    }
    
    case 'SAVE_SETTINGS': {
      await settingsManager.saveSettings(message.settings);
      
      // Update all trees with new capacity
      const tabIds = await treeStorage.getAllTabIds();
      for (const tabId of tabIds) {
        const tree = await treeStorage.getTree(tabId);
        // TODO: Update capacity in tree
        await treeStorage.saveTree(tabId, tree);
      }
      
      return { success: true, settings: settingsManager.get() };
    }
    
    default:
      return { success: false, error: 'Unknown settings message type' };
  }
}
