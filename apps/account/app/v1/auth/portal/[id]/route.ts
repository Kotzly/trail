import { NextResponse } from "next/server";
import { buildAccountSnapshot } from "@/src/server/account-snapshot";
import { createExtensionAccessToken } from "@/src/server/extension-auth";
import { getExtensionConfig } from "@/src/server/extension-config";
import { internalApiJson } from "@/src/server/internal-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ status: "expired" });
  }

  let response: {
    status: "pending" | "expired" | "approved";
    user?: {
      id: string;
      email: string | null;
      name: string | null;
      imageUrl: string | null;
      createdAt: string;
    };
  };

  try {
    response = await internalApiJson(
      `/api/internal/extension/portal/${encodeURIComponent(sessionId)}`,
      { method: "GET" },
    );
  } catch (error) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  if (response.status !== "approved") {
    return NextResponse.json({ status: response.status });
  }

  if (!response.user) {
    return NextResponse.json({ status: "expired" });
  }

  const token = createExtensionAccessToken(response.user.id);
  const config = await getExtensionConfig();

  return NextResponse.json({
    status: "approved",
    snapshot: buildAccountSnapshot({
      user: {
        ...response.user,
        createdAt: new Date(response.user.createdAt),
      },
      accessToken: token.token,
      expiresAt: token.expiresAt,
      config,
    }),
  });
}
