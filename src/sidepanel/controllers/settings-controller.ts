import { ThemeId } from "../ui/shared/themes";
import { PanelState } from "../state/panel-state";
import { defaultSettings } from "../../background/services/settings";
import { Settings } from "../../shared/types/settings";
import { saveSettings } from "../api/settings";

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme as string);
}

// Toggle settings popover at button position.
export function toggleSettingsPopover(e: MouseEvent): void {
  const popover = document.getElementById('settingsPopover');
  const btn = document.getElementById('settingsBtn');
  
  if (!popover || !btn) return;
  
  if (!popover.classList.contains('hidden')) {
    popover.classList.add('hidden');
    return;
  }
  
  // Position popover near button
  const btnRect = btn.getBoundingClientRect();
  const popoverWidth = 172; // Approximate width
  
  // Position to the left of button, below it
  let left = btnRect.right - popoverWidth;
  let top = btnRect.bottom + 8;
  
  // Ensure it fits in viewport
  if (left < 8) left = 8;
  if (top + 200 > window.innerHeight) {
    top = btnRect.top - 8;
    popover.style.transform = 'translateY(-100%)';
  } else {
    popover.style.transform = '';
  }
  
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  
  // Update active states
  updateThemeIcons(PanelState.settings?.theme || defaultSettings.theme);
  popover.classList.remove('hidden');
}

// Update theme icons active state.
function updateThemeIcons(theme: string): void {
  document.querySelectorAll('#themeIcons .popover-icon-btn').forEach(btn => {
    const btnEl = btn as HTMLElement;
    btnEl.classList.toggle('active', btnEl.dataset.theme === theme);
  });
}


// Save settings quickly (for popover - immediate save).
export async function saveSettingsQuick(updates: Partial<Settings>): Promise<void> {
  if (!PanelState.settings) return;
  const newSettings = { ...PanelState.settings, ...updates };
  PanelState.settings = newSettings;
  
  await saveSettings(newSettings);
}
