import {
  getUserOnboardingSeen,
  markUserOnboardingSeen,
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
    return jsonNoStore({ seen: false }, { status: 400 });
  }

  const seen = await getUserOnboardingSeen(id);
  if (seen === null) {
    return jsonNoStore({ seen: false }, { status: 404 });
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
    return jsonNoStore({ seen: false }, { status: 400 });
  }

  const seen = await markUserOnboardingSeen(id);
  if (seen === null) {
    return jsonNoStore({ seen: false }, { status: 404 });
  }

  return jsonNoStore({ seen: true });
}
