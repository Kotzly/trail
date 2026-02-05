export function getBearerToken(headers: Headers): string | null {
  const authHeader =
    headers.get("authorization") ?? headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  const scheme = parts[0] ?? "";
  const token = parts[1] ?? "";
  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
