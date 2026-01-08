import { settingsManager } from '../../services/settings.js';
import { treeStorage } from '../../services/tree-storage.js';

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
      return { success: true, settings: settingsManager.get() };
    }
    
    default:
      return { success: false, error: 'Unknown settings message type' };
  }
}
