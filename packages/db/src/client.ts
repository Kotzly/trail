import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL environment variable.",
  );
}

if (!supabaseKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. The db client requires the service role key for server-to-server operations (bypasses RLS).",
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
