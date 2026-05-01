import { z } from "zod";
import type { NodeData, NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";

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

export function normalizeNodeData(raw: unknown): NodeData {
  const candidate =
    raw && typeof raw === "object" && "data" in raw ? (raw as { data: unknown }).data : raw;
  const parsed = nodeDataSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  return nodeDataSchema.parse({});
}

export const navigationTreeJSONSchema = z.object({
  root: z.unknown().nullable(),
  currentNodeId: z.union([z.number(), z.null()]),
  nodeCount: finiteNumber,
});

export function isNavigationTreeJSON(value: unknown): value is NavigationTreeJSON {
  return navigationTreeJSONSchema.safeParse(value).success;
}

export type NodeDataInput = z.input<typeof nodeDataSchema>;
export type NavigationNodeJSONLike = NavigationNodeJSON;
