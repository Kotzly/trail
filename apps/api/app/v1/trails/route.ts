import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser } from "@/src/server/user";
import { db } from "@trail/db";

export const runtime = "nodejs";

type ApiLabelSource = "user" | "auto" | "system";

type DbLabelSource = "USER" | "AUTO" | "SYSTEM";

const LABEL_TO_API: Record<DbLabelSource, ApiLabelSource> = {
  USER: "user",
  AUTO: "auto",
  SYSTEM: "system",
};

function toApiLabelSource(value: DbLabelSource): ApiLabelSource {
  return LABEL_TO_API[value] ?? "user";
}

function toTrailSummary(trail: {
  id: string;
  userId: string;
  deviceId: string;
  label: string;
  labelSource: DbLabelSource;
  labelUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  savedAt: Date;
  nodeCount: number;
  rootUrl?: string | null;
  rootTitle?: string | null;
  rootFavicon?: string | null;
  deletedAt?: Date | null;
}) {
  return {
    id: trail.id,
    userId: trail.userId,
    deviceId: trail.deviceId,
    label: trail.label,
    labelSource: toApiLabelSource(trail.labelSource),
    labelUpdatedAt: trail.labelUpdatedAt.toISOString(),
    createdAt: trail.createdAt.toISOString(),
    updatedAt: trail.updatedAt.toISOString(),
    savedAt: trail.savedAt.toISOString(),
    nodeCount: trail.nodeCount,
    rootUrl: trail.rootUrl ?? null,
    rootTitle: trail.rootTitle ?? null,
    rootFavicon: trail.rootFavicon ?? null,
    deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
  };
}

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? limitRaw
      : 50;
  const cursorRaw = url.searchParams.get("cursor");
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";

  const cursorDate = cursorRaw ? new Date(cursorRaw) : null;
  const cursorFilter =
    cursorDate && !Number.isNaN(cursorDate.getTime())
      ? { updatedAt: { lt: cursorDate } }
      : {};

  const trails = await db.trail.findMany({
    where: {
      userId: user.id,
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...cursorFilter,
    },
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
  });

  const hasNext = trails.length > limit;
  const items = hasNext ? trails.slice(0, limit) : trails;
  const nextCursor = hasNext ? trails[limit]?.updatedAt.toISOString() : null;

  return jsonNoStore({
    items: items.map(toTrailSummary),
    nextCursor,
  });
}
