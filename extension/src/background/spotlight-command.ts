import { browser } from "@shared/platform/webext.js";

async function handleSpotlightCommand(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await browser.tabs.sendMessage(tab.id, { type: "TOGGLE_SPOTLIGHT" });
  } catch {
    // Content script not available on this page (chrome://, about:, etc.)
  }
}

export function initSpotlightCommand(): void {
  browser.commands.onCommand.addListener((command: string) => {
    if (command === "toggle-spotlight") {
      void handleSpotlightCommand();
    }
  });
}
