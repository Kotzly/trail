import { useCallback } from "react";
import { browser } from "@shared/platform/webext.js";
import { Icons } from "./Icon.js";
import { Button } from "@ui/components/ui/button";
import { ButtonTooltip } from "@ui/components/button-tooltip";

const SETTINGS_KEYS = ["meta", ","] as const;

export default function SettingsDropdown() {
  const handleGearClick = useCallback(() => {
    const url = chrome.runtime.getURL("settings.html");
    browser.tabs.create({ url, active: true }).catch((error) => {
      console.error("Failed to open hub page:", error);
    });
  }, []);

  return (
    <ButtonTooltip label="Settings" keys={SETTINGS_KEYS}>
      <Button
        id="settingsBtn"
        variant="outline"
        size="icon-sm"
        type="button"
        aria-label="Settings"
        onClick={handleGearClick}
      >
        <Icons.Settings />
      </Button>
    </ButtonTooltip>
  );
}
