export function getBearerToken(headers: Headers): string | null {
  const authHeader =
    headers.get("authorization") ?? headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^\s*Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}
