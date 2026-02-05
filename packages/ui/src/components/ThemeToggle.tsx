"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "../icons";
import { cn } from "../utils/cn";

const themes = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof themes)[number];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<ThemeMode>("system");

  React.useEffect(() => {
    const stored = window.localStorage.getItem("trail-theme") as ThemeMode | null;
    if (stored && themes.includes(stored)) {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    } else {
      document.documentElement.dataset.theme = "system";
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("trail-theme", next);
  };

  const icon =
    theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <Monitor />;

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface",
        "text-ink transition hover:bg-surface-high",
        className
      )}
      aria-label="Toggle theme"
    >
      {icon}
    </button>
  );
}
