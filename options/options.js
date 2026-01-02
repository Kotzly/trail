/**
 * Options page for Stack History extension.
 */

const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,
  stackCapacity: 100
};

/**
 * Send message to service worker.
 * @param {object} message
 * @returns {Promise<any>}
 */
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response?.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Show toast notification.
 * @param {string} message
 * @param {boolean} isError
 */
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.classList.remove('hidden', 'error');
  if (isError) toast.classList.add('error');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

/**
 * Load settings into form.
 */
async function loadSettings() {
  try {
    const { settings } = await sendMessage({ type: 'GET_SETTINGS' });
    
    document.getElementById('stackCapacity').value = settings.stackCapacity;
    document.getElementById('maxCachedLinks').value = settings.maxCachedLinks;
  } catch (error) {
    console.error('Failed to load settings:', error);
    showToast('Failed to load settings', true);
  }
}

/**
 * Save settings from form.
 * @param {Event} event
 */
async function saveSettings(event) {
  event.preventDefault();
  
  const settings = {
    stackCapacity: parseInt(document.getElementById('stackCapacity').value, 10),
    maxCachedLinks: parseInt(document.getElementById('maxCachedLinks').value, 10)
  };
  
  // Validation
  if (settings.stackCapacity < 10 || settings.stackCapacity > 1000) {
    showToast('Stack capacity must be between 10 and 1000', true);
    return;
  }
  
  if (settings.maxCachedLinks < 0 || settings.maxCachedLinks > 100) {
    showToast('Cached links must be between 0 and 100', true);
    return;
  }
  
  try {
    await sendMessage({ type: 'SAVE_SETTINGS', settings });
    showToast('Settings saved successfully');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('Failed to save settings', true);
  }
}

/**
 * Reset settings to defaults.
 */
async function resetSettings() {
  try {
    await sendMessage({ type: 'SAVE_SETTINGS', settings: DEFAULT_SETTINGS });
    
    document.getElementById('stackCapacity').value = DEFAULT_SETTINGS.stackCapacity;
    document.getElementById('maxCachedLinks').value = DEFAULT_SETTINGS.maxCachedLinks;
    
    showToast('Settings reset to defaults');
  } catch (error) {
    console.error('Failed to reset settings:', error);
    showToast('Failed to reset settings', true);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
});
