import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });

  return response;
}
