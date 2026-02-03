export function getBearerToken(headers: Headers): string | null {
  const authHeader = headers.get("authorization") ?? headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}
