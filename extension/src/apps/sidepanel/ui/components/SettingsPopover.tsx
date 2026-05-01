import { useCallback } from "react";
import { i18n } from "#i18n";
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
    <ButtonTooltip label={i18n.t("sidepanel.settingsPopover.label")} keys={SETTINGS_KEYS}>
      <Button
        id="settingsBtn"
        variant="secondary"
        size="icon"
        type="button"
        aria-label={i18n.t("sidepanel.settingsPopover.label")}
        onClick={handleGearClick}
        className="press-feedback"
      >
        <Icons.Settings />
      </Button>
    </ButtonTooltip>
  );
}
