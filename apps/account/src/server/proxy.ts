import { NextResponse } from "next/server";
import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { internalApiFetch } from "@/src/server/internal-api";

/**
 * Resolve the auth token from either the Bearer header (extension)
 * or the httpOnly cookie (site).
 */
async function resolveAuthToken(request: Request): Promise<string | null> {
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (auth) {
    const [scheme, token] = auth.split(" ");
    if (scheme === "Bearer" && token) return token;
  }

  return getAuthTokenFromCookies();
}

/**
 * Forward a request to the internal API (apps/api).
 *
 * - Resolves auth from Bearer header or httpOnly cookie.
 * - Streams body for POST/PATCH/PUT.
 * - Returns the upstream response as-is.
 */
export async function proxyToApi(
  request: Request,
  path: string,
): Promise<Response> {
  const token = await resolveAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 },
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  const hasBody = !["GET", "HEAD"].includes(request.method);
  let body: string | undefined;
  if (hasBody) {
    body = await request.text().catch(() => undefined);
  }

  let upstream: Response;
  try {
    upstream = await internalApiFetch(path, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return NextResponse.json(
      { code: "network", message: "Upstream unavailable", retryable: true },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  const contentType =
    upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
