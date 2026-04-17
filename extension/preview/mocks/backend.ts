// No-op replacement for @shared/config/backend.js

export async function initBackendConfig(): Promise<void> {
  // intentionally empty
}

export function getBackendUrl(): string {
  return "http://preview.local";
}

export function isSupabaseConfigured(): boolean {
  return false;
}

export function getBackendConfig(): { baseUrl: string; supabase: null } {
  return { baseUrl: "http://preview.local", supabase: null };
}

export function getSupabaseClient(): null {
  return null;
}
