import { browser } from "@shared/platform/webext.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import { Button } from "@ui/components/ui/button";
import { ButtonTooltip } from "@ui/components/button-tooltip";

export default function SettingsDropdown() {
  const metaKey = useStore((state) => state.metaKey);
  const meta = metaKey?.short ?? "Ctrl";

  const handleGearClick = () => {
    const url = chrome.runtime.getURL("settings.html");
    browser.tabs.create({ url, active: true }).catch((error) => {
      console.error("Failed to open hub page:", error);
    });
  };

  return (
    <ButtonTooltip label="Settings" keys={[meta, ","]}>
      <Button
        id="settingsBtn"
        variant="ghost"
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
