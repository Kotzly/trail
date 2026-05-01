"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function renameTrailById(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const parsed = RenameSchema.safeParse({
    trailId: formData.get("trailId"),
    label: formData.get("label"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

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

  if (error) return { error: "Failed to rename trail" };

  revalidatePath(`/trails/${trailId}`);
  revalidatePath("/trails");
  return { success: true };
}

export async function archiveTrailById(
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

  if (error) return { error: "Failed to archive trail" };

  revalidatePath("/trails");
  redirect("/trails");
}

export async function exportTrail(trailId: string): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const idParsed = z.string().uuid().safeParse(trailId);
  if (!idParsed.success) return { error: "Invalid trail ID" };

  const { data, error } = await db
    .from("trails")
    .select("id, label, node_count, root_url, root_title, created_at, updated_at, payload")
    .eq("id", idParsed.data)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) return { error: "Failed to load trail" };
  if (!data) return { error: "Trail not found" };

  return { success: true, data };
}
