export const SUPPORTED_LOCALES = ["en"] as const;
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(
  value: string | undefined,
): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}
