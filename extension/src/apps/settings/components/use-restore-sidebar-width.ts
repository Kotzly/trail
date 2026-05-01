import { useEffect } from "react";

const STORAGE_KEY = "trail-settings-sidebar-width";

export function useRestoreSidebarWidth() {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!stored) return;
    const wrapper = document.querySelector<HTMLElement>("[data-slot='sidebar-wrapper']");
    if (wrapper) wrapper.style.setProperty("--sidebar-width", stored);
  }, []);
}
