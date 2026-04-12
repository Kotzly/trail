import { browser } from "@shared/platform/webext.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import { Button } from "@ui/components/ui/button";

export default function SettingsDropdown() {
  const metaKey = useStore((state) => state.metaKey);

  const settingsShortcut = metaKey ? `${metaKey.short}+,` : "Ctrl+,";
  const tooltipsShortcut = metaKey ? `${metaKey.short}+/` : "Ctrl+/";
  const settingsLabel = `Settings (${settingsShortcut})`;
  const settingsTooltip = `Settings (${settingsShortcut}) • Tooltips (${tooltipsShortcut})`;

  const handleGearClick = () => {
    const url = chrome.runtime.getURL("settings.html");
    browser.tabs.create({ url, active: true }).catch((error) => {
      console.error("Failed to open hub page:", error);
    });
  };

  return (
    <Button
      id="settingsBtn"
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={settingsLabel}
      data-tooltip={settingsTooltip}
      onClick={handleGearClick}
    >
      <Icons.Settings />
    </Button>
  );
}
