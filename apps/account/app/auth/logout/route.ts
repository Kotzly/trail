import { NextResponse } from "next/server";
import { getAuthCookieName } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));

  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });

  return response;
}
