import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

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

export async function getTrailsList(options?: {
  limit?: number;
  cursor?: string;
}): Promise<TrailsListResponse | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) return null;

  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return internalApiJson<TrailsListResponse>(`/api/v1/trails${qs}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
}

export async function getTrailById(id: string): Promise<TrailDetail | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) return null;

  return internalApiJson<TrailDetail>(
    `/api/v1/trails/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  ).catch(() => null);
}
