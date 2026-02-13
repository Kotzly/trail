const INTERNAL_BASE_URL = new URL("https://trail.local");
const DEFAULT_FALLBACK = "/trails";

function normalizeInternalPath(
  value: string,
  fallback: string = DEFAULT_FALLBACK,
): string {
  try {
    const resolved = new URL(value, INTERNAL_BASE_URL);
    if (
      resolved.origin !== INTERNAL_BASE_URL.origin ||
      resolved.protocol !== INTERNAL_BASE_URL.protocol
    ) {
      return fallback;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function resolveSafeNextPath(
  nextParam: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  const safeFallback = normalizeInternalPath(fallback, DEFAULT_FALLBACK);

  if (typeof nextParam !== "string") {
    return safeFallback;
  }

  const trimmed = nextParam.trim();
  if (!trimmed) {
    return safeFallback;
  }

  return normalizeInternalPath(trimmed, safeFallback);
}
