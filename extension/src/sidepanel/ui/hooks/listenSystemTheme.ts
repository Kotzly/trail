import { useEffect } from "react";
import { useStore } from "../state/store";
import { applyTheme } from "../shared/apply-theme";

export function listenSystemTheme() {
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = () => {
        const settings = useStore.getState().settings;
        if (!settings || settings.theme !== 'system') return;
        applyTheme("system", settings.customTheme);
    }

    onChange(); // sync on start

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
}