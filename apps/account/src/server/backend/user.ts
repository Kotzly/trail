import { singleRow, maybeRow } from "@trail/db/helpers";
import type {
  PostgrestSingleResponse,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { AppUser } from "@trail/auth-token";

type AuthUser = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  image?: string;
};

type UserSummary = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
  onboardingSeenAt: Date | null;
};

// Helper to give untyped Supabase results a concrete type
function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

function resolveImageUrl(image?: string | null, imageUrl?: string | null) {
  return image ?? imageUrl ?? null;
}

export async function ensureUser(
  authUser: AuthUser,
  client: SupabaseClient,
): Promise<AppUser | null> {
  if (!authUser.sub) {
    return null;
  }

  const record = maybeRow(
    typed<{
      id: string;
      email: string | null;
      name: string | null;
      image: string | null;
      image_url: string | null;
    } | null>(
      await client
        .from("users")
        .select("id, email, name, image, image_url")
        .eq("id", authUser.sub)
        .maybeSingle(),
    ),
  );

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: resolveImageUrl(record.image, record.image_url),
  };
}

/** Create public.users row for a Supabase Auth user.
 *  Must be called with an authenticated Supabase client (user JWT)
 *  so the INSERT passes the RLS "insert_own" policy. */
export async function ensurePublicUser(
  user: {
    id: string;
    email: string;
    name: string;
    imageUrl?: string | null;
  },
  client: SupabaseClient,
): Promise<void> {
  const now = new Date().toISOString();
  const result = await client.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.imageUrl ?? null,
      image_url: user.imageUrl ?? null,
      created_at: now,
      updated_at: now,
      auth_session_version: 1,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (result.error) {
    throw new Error(`ensurePublicUser failed: ${result.error.message}`);
  }
  const { error: rpcError } = await client.rpc("sync_public_user_from_auth", {
    p_user_id: user.id,
  });
  if (rpcError) {
    console.error("[ensurePublicUser] sync_public_user_from_auth failed", {
      userId: user.id,
      error: rpcError,
    });
  }
}

export async function getUserById(
  userId: string,
  client: SupabaseClient,
): Promise<UserSummary | null> {
  const record = maybeRow(
    typed<{
      id: string;
      email: string | null;
      name: string | null;
      image: string | null;
      image_url: string | null;
      created_at: string;
      onboarding_seen_at: string | null;
    } | null>(
      await client
        .from("users")
        .select(
          "id, email, name, image, image_url, created_at, onboarding_seen_at",
        )
        .eq("id", userId)
        .maybeSingle(),
    ),
  );

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: resolveImageUrl(record.image, record.image_url),
    createdAt: new Date(record.created_at),
    onboardingSeenAt: record.onboarding_seen_at
      ? new Date(record.onboarding_seen_at)
      : null,
  };
}

export async function getUserOnboardingSeen(
  userId: string,
  client: SupabaseClient,
): Promise<boolean | null> {
  const record = maybeRow(
    typed<{ onboarding_seen_at: string | null } | null>(
      await client
        .from("users")
        .select("onboarding_seen_at")
        .eq("id", userId)
        .maybeSingle(),
    ),
  );

  if (!record) {
    return null;
  }

  return record.onboarding_seen_at !== null;
}

export async function markUserOnboardingSeen(
  userId: string,
  client: SupabaseClient,
): Promise<Date | null> {
  // COALESCE semantics: only set if not already set
  const existing = maybeRow(
    typed<{ onboarding_seen_at: string | null } | null>(
      await client
        .from("users")
        .select("onboarding_seen_at")
        .eq("id", userId)
        .maybeSingle(),
    ),
  );

  if (!existing) {
    return null;
  }

  if (existing.onboarding_seen_at !== null) {
    return new Date(existing.onboarding_seen_at);
  }

  const updated = singleRow(
    typed<{ onboarding_seen_at: string | null }>(
      await client
        .from("users")
        .update({
          onboarding_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .is("onboarding_seen_at", null)
        .select("onboarding_seen_at")
        .single(),
    ),
  );

  return updated.onboarding_seen_at
    ? new Date(updated.onboarding_seen_at)
    : null;
}

export async function resetUserOnboarding(
  userId: string,
  client: SupabaseClient,
): Promise<boolean> {
  const result = await client
    .from("users")
    .update({
      onboarding_seen_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id");

  if (result.error) {
    throw new Error(`Supabase query failed: ${result.error.message}`);
  }

  return ((result.data as Array<{ id: string }> | null)?.length ?? 0) > 0;
}

export type { AuthUser };
