"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@trail/db";
import { getAuthSession } from "@/src/lib/auth";

type ActionResult = { error?: string; success?: boolean; data?: unknown };

const RenameSchema = z.object({
  trailId: z.string().uuid(),
  label: z.string().min(1).max(200),
});

const TrailIdSchema = z.object({
  trailId: z.string().uuid(),
});

const LoadMoreSchema = z.object({
  cursor: z.string().optional(),
  includeDeleted: z.boolean().optional(),
});

export async function renameTrail(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const parsed = RenameSchema.safeParse({
    trailId: formData.get("trailId"),
    label: formData.get("label"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { trailId, label } = parsed.data;
  const now = new Date().toISOString();

  const { error } = await db
    .from("trails")
    .update({
      label,
      label_source: "USER",
      label_updated_at: now,
      updated_at: now,
    })
    .eq("id", trailId)
    .eq("user_id", session.user.id);

  if (error) {
    console.error("[mutations] rename trail:", error);
    return { error: "Failed to rename trail" };
  }

  revalidatePath("/trails");
  return { success: true };
}

export async function archiveTrail(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const parsed = TrailIdSchema.safeParse({ trailId: formData.get("trailId") });
  if (!parsed.success) return { error: "Invalid trail ID" };

  const { error } = await db
    .from("trails")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.trailId)
    .eq("user_id", session.user.id);

  if (error) {
    console.error("[mutations] archive trail:", error);
    return { error: "Failed to archive trail" };
  }

  revalidatePath("/trails");
  return { success: true };
}

export async function restoreTrail(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const parsed = TrailIdSchema.safeParse({ trailId: formData.get("trailId") });
  if (!parsed.success) return { error: "Invalid trail ID" };

  const { error } = await db
    .from("trails")
    .update({ deleted_at: null })
    .eq("id", parsed.data.trailId)
    .eq("user_id", session.user.id);

  if (error) {
    console.error("[mutations] restore trail:", error);
    return { error: "Failed to restore trail" };
  }

  revalidatePath("/trails");
  return { success: true };
}

export async function loadMoreTrails(
  cursor: string,
  includeDeleted = false,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const parsed = LoadMoreSchema.safeParse({ cursor, includeDeleted });
  if (!parsed.success) return { error: "Invalid parameters" };

  const limit = 50;

  let query = db
    .from("trails")
    .select(
      "id, user_id, device_id, label, label_source, label_updated_at, created_at, updated_at, saved_at, node_count, root_url, root_title, root_favicon, deleted_at",
    )
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (!parsed.data.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (parsed.data.cursor) {
    const sepIndex = parsed.data.cursor.indexOf("|");
    if (sepIndex !== -1) {
      const updatedAtRaw = parsed.data.cursor.slice(0, sepIndex);
      const id = parsed.data.cursor.slice(sepIndex + 1);
      if (updatedAtRaw && id) {
        query = query.or(
          `updated_at.lt.${updatedAtRaw},and(updated_at.eq.${updatedAtRaw},id.lt.${id})`,
        );
      }
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[mutations] loadMoreTrails:", error);
    return { error: "Failed to load trails" };
  }

  const rows = data ?? [];
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasNext && lastItem ? `${lastItem.updated_at}|${lastItem.id}` : null;

  return {
    success: true,
    data: { items, nextCursor },
  };
}
