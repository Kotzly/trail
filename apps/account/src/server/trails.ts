import { db } from "@trail/db";
import { getAuthSession } from "@/src/lib/auth";

export type TrailSummary = {
  id: string;
  label: string;
  labelSource: "user" | "auto" | "system";
  createdAt: string;
  updatedAt: string;
  savedAt: string;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
  deviceId: string;
};

export type TrailDetail = TrailSummary & {
  userId: string;
  labelUpdatedAt: string;
  payload: unknown;
  deletedAt: string | null;
};

type TrailsListResponse = {
  items: TrailSummary[];
  nextCursor: string | null;
  totalCount: number;
};

type TrailCursor = {
  updatedAt: Date;
  id: string;
};

function toApiLabelSource(value: string): "user" | "auto" | "system" {
  const lowered = value.toLowerCase();
  if (lowered === "auto" || lowered === "system") {
    return lowered;
  }
  return "user";
}

function parseCursor(raw: string | undefined): TrailCursor | null {
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

function encodeCursor(cursor: TrailCursor): string {
  return `${cursor.updatedAt.toISOString()}|${cursor.id}`;
}

function toTrailSummary(trail: {
  id: string;
  label: string;
  labelSource: string;
  createdAt: Date;
  updatedAt: Date;
  savedAt: Date;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
  deviceId: string;
}): TrailSummary {
  return {
    id: trail.id,
    label: trail.label,
    labelSource: toApiLabelSource(trail.labelSource),
    createdAt: trail.createdAt.toISOString(),
    updatedAt: trail.updatedAt.toISOString(),
    savedAt: trail.savedAt.toISOString(),
    nodeCount: trail.nodeCount,
    rootUrl: trail.rootUrl,
    rootTitle: trail.rootTitle,
    rootFavicon: trail.rootFavicon,
    deviceId: trail.deviceId,
  };
}

async function resolveAuthedUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user.id ?? null;
}

export async function getTrailsList(options?: {
  limit?: number;
  cursor?: string;
}): Promise<TrailsListResponse | null> {
  const userId = await resolveAuthedUserId();
  if (!userId) {
    return null;
  }

  const limit =
    typeof options?.limit === "number" && options.limit > 0 && options.limit <= 200
      ? options.limit
      : 50;
  const cursor = parseCursor(options?.cursor);

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

  const [trails, totalCount] = await Promise.all([
    db.trail.findMany({
      where: {
        userId,
        deletedAt: null,
        ...cursorFilter,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    }),
    db.trail.count({ where: { userId, deletedAt: null } }),
  ]);

  const hasNext = trails.length > limit;
  const items = hasNext ? trails.slice(0, limit) : trails;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasNext && lastItem
      ? encodeCursor({ updatedAt: lastItem.updatedAt, id: lastItem.id })
      : null;

  return {
    items: items.map(toTrailSummary),
    nextCursor,
    totalCount,
  };
}

export async function getTrailById(id: string): Promise<TrailDetail | null> {
  const userId = await resolveAuthedUserId();
  if (!userId) {
    return null;
  }

  const trail = await db.trail.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!trail) {
    return null;
  }

  return {
    ...toTrailSummary(trail),
    userId: trail.userId,
    labelUpdatedAt: trail.labelUpdatedAt.toISOString(),
    payload: trail.payload,
    deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
  };
}
