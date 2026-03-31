import type { User } from "@trail/trpc";
import { db } from "@trail/db";
import { singleRow } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

export async function ensureUser(user: User): Promise<User | undefined> {
  if (!user.id || !user.email || !user.name) {
    return undefined;
  }

  const record = singleRow(
    typed<{ id: string; email: string | null; name: string | null; image: string | null; image_url: string | null }>(
      await db
        .from("users")
        .upsert(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.imageUrl ?? null,
            image_url: user.imageUrl ?? null,
            email_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select("id, email, name, image, image_url")
        .single(),
    ),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: (record.image ?? record.image_url) ?? undefined,
  };
}
