import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";

export const runtime = "nodejs";

function buildLogoutResponse(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return buildLogoutResponse(NextResponse.redirect(new URL("/", url.origin)));
}

export async function POST() {
  return buildLogoutResponse(new NextResponse(null, { status: 204 }));
}
