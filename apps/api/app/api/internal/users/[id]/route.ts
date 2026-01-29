import { NextResponse } from "next/server";
import { getUserById } from "@/src/server/user";
import { requireInternalKey } from "@/src/server/internal-auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ user: null }, { status: 400 });
  }

  const user = await getUserById(id);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt.toISOString()
    }
  });
}
