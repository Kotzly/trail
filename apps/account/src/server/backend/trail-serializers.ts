/* ------------------------------------------------------------------ */
/*  Shared trail serialization helpers for API route handlers          */
/* ------------------------------------------------------------------ */

export type ApiLabelSource = "user" | "auto" | "system";

export type DbLabelSource = "USER" | "AUTO" | "SYSTEM";

export const LABEL_TO_API: Record<DbLabelSource, ApiLabelSource> = {
  USER: "user",
  AUTO: "auto",
  SYSTEM: "system",
};

export function toApiLabelSource(value: DbLabelSource): ApiLabelSource {
  return LABEL_TO_API[value] ?? "user";
}

/**
 * Serialize a full trail record (including payload) for the API response.
 */
export function toTrailRecord(trail: {
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
  payload: unknown;
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
    payload: trail.payload,
    deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
  };
}

/**
 * Serialize a trail summary (without payload) for the list API response.
 */
export function toTrailSummary(trail: {
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
