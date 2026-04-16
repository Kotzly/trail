import { useEffect, useState, useCallback } from "react";
import type { Settings } from "@shared/types/settings.js";
import { getSettings, saveSettings } from "../api.js";

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch } as Settings;
      saveSettings(next).catch(console.error);
      return next;
    });
  }, []);

  return { settings, loading, error, updateSettings };
}
