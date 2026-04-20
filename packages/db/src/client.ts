import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./generated/database.types.js";

export type { Database, SupabaseClient };
export type TrailDbClient = SupabaseClient<Database>;

type GlobalWithSupabase = typeof globalThis & {
  __trailSupabase?: TrailDbClient;
};

function readEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL environment variable.",
    );
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. The db client requires the service role key for server-to-server operations (bypasses RLS).",
    );
  }
  return { url, key };
}

export function createDb(): TrailDbClient {
  const { url, key } = readEnv();
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getOrCreate(): TrailDbClient {
  const g = globalThis as GlobalWithSupabase;
  if (g.__trailSupabase) return g.__trailSupabase;
  const instance = createDb();
  if (process.env.NODE_ENV !== "production") {
    g.__trailSupabase = instance;
  }
  return instance;
}

export const db: TrailDbClient = new Proxy({} as TrailDbClient, {
  get(_target, prop, receiver) {
    const instance = getOrCreate();
    return Reflect.get(instance, prop, receiver);
  },
  has(_target, prop) {
    return prop in getOrCreate();
  },
});
