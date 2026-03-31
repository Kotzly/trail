import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL environment variable.",
  );
}

if (!supabaseKey) {
  throw new Error(
    "Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const globalForSupabase = globalThis as {
  supabase?: SupabaseClient;
};

export const db =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = db;
}

export type { SupabaseClient };
