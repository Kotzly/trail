import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import {
  revokeExtensionTokensForUser,
  verifyExtensionToken,
} from "@/src/server/backend/auth/extension-auth";

export const runtime = "nodejs";

function getAuthTokenFromCookie(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const rawCookie of cookies) {
    const [rawName, ...rawValueParts] = rawCookie.trim().split("=");
    if (rawName !== AUTH_COOKIE_NAME) {
      continue;
    }
    const rawValue = rawValueParts.join("=");
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

async function revokeExtensionAuth(request: Request): Promise<void> {
  const token =
    getBearerToken(request.headers) ?? getAuthTokenFromCookie(request.headers);
  if (!token) {
    return;
  }

  const user = await verifyUserToken(token);
  if (user?.sub) {
    await revokeExtensionTokensForUser(user.sub);
    return;
  }

  const extensionUser = await verifyExtensionToken(token);
  if (!extensionUser?.sub) {
    return;
  }

  await revokeExtensionTokensForUser(extensionUser.sub);
}

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
  await revokeExtensionAuth(request).catch(() => undefined);
  return buildLogoutResponse(NextResponse.redirect(new URL("/", url.origin)));
}

export async function POST(request: Request) {
  await revokeExtensionAuth(request).catch(() => undefined);
  return buildLogoutResponse(new NextResponse(null, { status: 204 }));
}
