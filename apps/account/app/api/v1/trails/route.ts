import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserFromToken } from "@/src/lib/auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { toTrailSummary } from "@/src/server/backend/trail-serializers";
import { ensureUser } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { db } from "@trail/db";

export const runtime = "nodejs";

type TrailCursor = {
  updatedAt: Date;
  id: string;
};

function encodeCursor(cursor: TrailCursor): string {
  return `${cursor.updatedAt.toISOString()}|${cursor.id}`;
}

function parseCursor(raw: string | null): TrailCursor | null {
  if (!raw) {
    return null;
  }

  const sepIndex = raw.indexOf("|");
  if (sepIndex === -1) {
    return null;
  }

  const updatedAtRaw = raw.slice(0, sepIndex);
  const id = raw.slice(sepIndex + 1);
  if (!updatedAtRaw || !id) {
    return null;
  }

  const updatedAt = new Date(updatedAtRaw);
  if (Number.isNaN(updatedAt.getTime())) {
    return null;
  }

  return { updatedAt, id };
}

async function resolveUser(request: Request) {
  // 1. Try extension bearer token
  const bearer = getBearerToken(request.headers);
  if (bearer) {
    const ext = await verifyExtensionToken(bearer);
    if (ext?.sub) {
      return ensureUser({ sub: ext.sub });
    }

    // Try as extension token via getUserFromToken fallback
    const user = await getUserFromToken(bearer);
    if (user) {
      return { id: user.id, email: user.email, name: user.name, imageUrl: user.imageUrl };
    }
  }

  // 2. Try Supabase cookie session
  const supabase = await createSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    return ensureUser({
      sub: supabaseUser.id,
      email: supabaseUser.email ?? undefined,
      name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name,
    });
  }

  return null;
}

export async function GET(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? limitRaw
      : 50;
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";

  const cursorFilter = cursor
    ? {
        OR: [
          { updatedAt: { lt: cursor.updatedAt } },
          {
            updatedAt: cursor.updatedAt,
            id: { lt: cursor.id },
          },
        ],
      }
    : {};

  const baseWhere = {
    userId: user.id,
    ...(includeDeleted ? {} : { deletedAt: null }),
  };

  const [trails, totalCount] = await Promise.all([
    db.trail.findMany({
      where: {
        ...baseWhere,
        ...cursorFilter,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    }),
    db.trail.count({ where: baseWhere }),
  ]);

  const hasNext = trails.length > limit;
  const items = hasNext ? trails.slice(0, limit) : trails;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasNext && lastItem
      ? encodeCursor({ updatedAt: lastItem.updatedAt, id: lastItem.id })
      : null;

  return jsonNoStore({
    items: items.map(toTrailSummary),
    nextCursor,
    totalCount,
  });
}
