/**
 * Options page for Stack History extension.
 */

import { getViewModes, DEFAULT_VIEW_MODE, isValidViewMode } from '../lib/view-modes.js';

const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,
  stackCapacity: 100,
  viewMode: DEFAULT_VIEW_MODE,
  theme: 'system',
  forestMode: true
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
    document.getElementById('forestMode').checked = settings.forestMode !== false;
    
    // Update view mode selection
    updateViewModeSelection(settings.viewMode || DEFAULT_VIEW_MODE);
    
    // Update theme selection
    updateThemeSelection(settings.theme || 'system');
    applyTheme(settings.theme || 'system');
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
  
  const selectedViewMode = document.querySelector('input[name="viewMode"]:checked')?.value || DEFAULT_VIEW_MODE;
  const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || 'system';
  
  const settings = {
    stackCapacity: parseInt(document.getElementById('stackCapacity').value, 10),
    maxCachedLinks: parseInt(document.getElementById('maxCachedLinks').value, 10),
    viewMode: selectedViewMode,
    theme: selectedTheme,
    forestMode: document.getElementById('forestMode').checked
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
    document.getElementById('forestMode').checked = DEFAULT_SETTINGS.forestMode;
    updateViewModeSelection(DEFAULT_SETTINGS.viewMode);
    updateThemeSelection(DEFAULT_SETTINGS.theme);
    applyTheme(DEFAULT_SETTINGS.theme);
    
    showToast('Settings reset to defaults');
  } catch (error) {
    console.error('Failed to reset settings:', error);
    showToast('Failed to reset settings', true);
  }
}

/**
 * Initialize view mode options UI.
 */
function initViewModeOptions() {
  const container = document.getElementById('viewModeOptions');
  const viewModes = getViewModes();
  
  viewModes.forEach(mode => {
    const option = document.createElement('label');
    option.className = 'view-mode-option';
    option.dataset.mode = mode.id;
    
    option.innerHTML = `
      <input type="radio" name="viewMode" value="${mode.id}">
      <div class="view-mode-radio"></div>
      <div class="view-mode-icon">${mode.icon}</div>
      <div class="view-mode-content">
        <div class="view-mode-label">${mode.label}</div>
        <div class="view-mode-description">${mode.description}</div>
      </div>
    `;
    
    option.addEventListener('click', () => {
      updateViewModeSelection(mode.id);
    });
    
    container.appendChild(option);
  });
}

/**
 * Update view mode selection UI.
 * @param {string} modeId
 */
function updateViewModeSelection(modeId) {
  const options = document.querySelectorAll('.view-mode-option');
  options.forEach(opt => {
    const isSelected = opt.dataset.mode === modeId;
    opt.classList.toggle('selected', isSelected);
    opt.querySelector('input[type="radio"]').checked = isSelected;
  });
}

/**
 * Update theme selection UI.
 * @param {string} theme
 */
function updateThemeSelection(theme) {
  const options = document.querySelectorAll('.theme-option');
  options.forEach(opt => {
    const isSelected = opt.dataset.theme === theme;
    opt.classList.toggle('selected', isSelected);
    opt.querySelector('input[type="radio"]').checked = isSelected;
  });
}

/**
 * Apply theme to document.
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Initialize theme options.
 */
function initThemeOptions() {
  const options = document.querySelectorAll('.theme-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      updateThemeSelection(theme);
      applyTheme(theme);
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initThemeOptions();
  initViewModeOptions();
  loadSettings();
  
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
});
