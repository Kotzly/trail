import { env } from "@/src/env";

/**
 * Validate that a billing redirect URL belongs to the app's own origin.
 * Returns the validated URL string, or the fallback if the input is
 * missing, malformed, or points to a disallowed origin.
 */
export function validateRedirectUrl(
  raw: string | undefined | null,
  fallback: string,
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fallback;
  }

  // Only allow http(s) schemes — block javascript:, data:, etc.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return fallback;
  }

  const appOrigin = new URL(env.appBaseUrl).origin;
  if (parsed.origin !== appOrigin) {
    return fallback;
  }

  return trimmed;
}
