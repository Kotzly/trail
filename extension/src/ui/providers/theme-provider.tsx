import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes wrapper. Uses `trail_theme_choice` as the storage key so the
 * synchronous `public/apply-theme-early.js` FOUC-prevention script and the
 * React side agree on the value.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="trail_theme_choice"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
