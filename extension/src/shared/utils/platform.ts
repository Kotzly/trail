import { browser } from "@shared/platform/webext.js";
export async function isMac(): Promise<boolean> {
  try {
    const info = await browser.runtime.getPlatformInfo();
    return info.os === "mac";
  } catch (error) {
    console.error("Failed to get platform info:", error);
    return false;
  }
}
