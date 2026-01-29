import { NextResponse } from "next/server";
import { getAuthSession, getDevUser, isAuthBypassed } from "@/src/lib/auth0";

export const runtime = "nodejs";

const TRAIL_API_BASE_URL = process.env.TRAIL_API_BASE_URL;
const TRAIL_INTERNAL_API_KEY = process.env.TRAIL_INTERNAL_API_KEY;

async function proxyToApi(request: Request): Promise<Response> {
  if (!TRAIL_API_BASE_URL) {
    return NextResponse.json({ error: "missing_TRAIL_API_BASE_URL" }, { status: 500 });
  }

  if (!TRAIL_INTERNAL_API_KEY) {
    return NextResponse.json({ error: "missing_TRAIL_INTERNAL_API_KEY" }, { status: 500 });
  }

  const session = await getAuthSession();
  const user = session?.user ?? null;
  const authBypassed = isAuthBypassed();

  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, TRAIL_API_BASE_URL);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("cookie");
  headers.delete("x-trail-internal-key");
  headers.delete("x-trail-user");
  headers.delete("x-trail-auth0-user");

  headers.set("x-trail-internal-key", TRAIL_INTERNAL_API_KEY);
  if (authBypassed) {
    headers.set("x-trail-user", JSON.stringify(getDevUser()));
  } else if (user) {
    headers.set("x-trail-auth0-user", JSON.stringify(user));
  }

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual"
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers
  });
}

export const GET = proxyToApi;
export const POST = proxyToApi;
