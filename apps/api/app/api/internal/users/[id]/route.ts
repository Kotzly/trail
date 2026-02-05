import { getUserById } from "@/src/server/user";
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
    return jsonNoStore({ user: null }, { status: 400 });
  }

  const user = await getUserById(id);
  if (!user) {
    return jsonNoStore({ user: null });
  }

  return jsonNoStore({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
