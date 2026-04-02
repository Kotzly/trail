const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[];

export function corsHeaders(origin?: string | null): Record<string, string> {
  const isExtension = origin?.startsWith("chrome-extension://");
  const isAllowed = origin && (isExtension || ALLOWED_ORIGINS.includes(origin));
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function optionsResponse(request: Request): Response {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
