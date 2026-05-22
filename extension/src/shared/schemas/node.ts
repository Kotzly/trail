import { z } from "zod";
import type { NavigationNodeJSON, NodeData } from "@shared/types/node.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("node-schema");

const finiteNumber = z.number().refine(Number.isFinite);

const layoutSchema = z
  .object({
    offsetX: finiteNumber.optional(),
    offsetY: finiteNumber.optional(),
  })
  .transform((raw) => {
    if (raw.offsetX === undefined && raw.offsetY === undefined) return undefined;
    return { offsetX: raw.offsetX ?? 0, offsetY: raw.offsetY ?? 0 };
  });

export const nodeDataSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
    favicon: z.string().optional(),
    pinned: z.unknown().transform((v) => Boolean(v)),
    tags: z
      .array(z.unknown())
      .optional()
      .transform((arr) => (arr ?? []).filter((t): t is string => typeof t === "string")),
    lastVisitedAt: finiteNumber.optional(),
    visitCount: finiteNumber.refine((n) => n > 0).optional(),
    layout: layoutSchema.optional(),
  })
  .transform(
    (raw): NodeData =>
      ({
        url: (raw.url ?? "") as NodeData["url"],
        title: (raw.title ?? "") as NodeData["title"],
        favicon: raw.favicon as NodeData["favicon"],
        pinned: raw.pinned,
        tags: raw.tags as NodeData["tags"],
        lastVisitedAt: raw.lastVisitedAt as NodeData["lastVisitedAt"],
        visitCount: raw.visitCount,
        layout: raw.layout,
      }) as NodeData,
  );

/**
 * Full Zod-backed validation + normalization. Use ONLY for inputs from
 * trust boundaries:
 *   - sync pull from server (Supabase row payloads)
 *   - import bundles (file/export upload)
 *
 * On parse failure, retries once with `visitCount` stripped before
 * falling through to the empty default. Without this, a single bad
 * `visitCount: 0` (or negative) from a malformed payload wipes the
 * entire node (url, title, tags blank) — the old `normalizeNodeData`
 * had this footgun. The retry preserves the rest of the node and just
 * drops the offending counter.
 */
export function validateNodeData(raw: unknown): NodeData {
  const candidate =
    raw && typeof raw === "object" && "data" in raw ? (raw as { data: unknown }).data : raw;
  const parsed = nodeDataSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  if (candidate && typeof candidate === "object") {
    const rest: Record<string, unknown> = { ...(candidate as Record<string, unknown>) };
    if ("visitCount" in rest) {
      log.warn("validateNodeData: stripping invalid visitCount and retrying", {
        field: "visitCount",
        sampleValue: rest.visitCount,
      });
    }
    delete rest.visitCount;
    const retry = nodeDataSchema.safeParse(rest);
    if (retry.success) return retry.data;
  }
  return nodeDataSchema.parse({});
}

/**
 * Fast-path normalizer for trusted inputs — SW cold-load from local
 * storage, undo restore, in-process serialize→deserialize round trips.
 *
 * The data was produced by `toJSON` (or written through the same
 * pipeline) so its shape is already canonical: `pinned: boolean`,
 * `tags: string[]`, strings present where required.
 *
 * The one-branch defaults guard against legacy active-blob storage
 * written before the current schema landed (`pinned` or `tags` may be
 * absent). On already-canonical input the function returns the source
 * data by reference — zero allocation, branch-predictable.
 */
export function normalizeNodeDataTrusted(json: NavigationNodeJSON): NodeData {
  const d = json.data;
  if (d.pinned !== undefined && d.tags !== undefined) return d;
  return { ...d, pinned: d.pinned ?? false, tags: d.tags ?? [] };
}

export type NodeDataInput = z.input<typeof nodeDataSchema>;
export type NavigationNodeJSONLike = NavigationNodeJSON;
