import {
  getUserOnboardingSeen,
  markUserOnboardingSeen,
  resetUserOnboarding,
} from "@/src/server/user";
import { requireInternalKey } from "@/src/server/internal-auth";
import { jsonNoStore } from "@/src/server/response";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;
  if (!id) {
    return jsonNoStore({ seen: false, seenAt: null }, { status: 400 });
  }

  const seen = await getUserOnboardingSeen(id);
  if (seen === null) {
    return jsonNoStore({ seen: false, seenAt: null }, { status: 404 });
  }

  return jsonNoStore({ seen });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;
  if (!id) {
    return jsonNoStore({ seen: false, seenAt: null }, { status: 400 });
  }

  const seenAt = await markUserOnboardingSeen(id);
  if (seenAt === null) {
    return jsonNoStore({ seen: false, seenAt: null }, { status: 404 });
  }

  return jsonNoStore({
    seen: true,
    seenAt: seenAt.toISOString(),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return jsonNoStore(
      { code: "forbidden", message: "Not available in production." },
      { status: 403 },
    );
  }

  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;
  if (!id) {
    return jsonNoStore({ reset: false }, { status: 400 });
  }

  const reset = await resetUserOnboarding(id);
  return jsonNoStore({ reset });
}
