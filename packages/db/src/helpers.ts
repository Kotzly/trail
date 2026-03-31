import type { PostgrestSingleResponse, PostgrestResponse } from "@supabase/supabase-js";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonInputValue = JsonValue;

export function singleRow<T>(result: PostgrestSingleResponse<T>): T {
  if (result.error) {
    throw new Error(`Supabase query failed: ${result.error.message}`);
  }
  return result.data;
}

export function maybeRow<T>(result: PostgrestSingleResponse<T | null>): T | null {
  if (result.error) {
    if (result.error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Supabase query failed: ${result.error.message}`);
  }
  return result.data;
}

export function assertOk<T>(result: PostgrestResponse<T> | PostgrestSingleResponse<T>): void {
  if (result.error) {
    throw new Error(`Supabase query failed: ${result.error.message}`);
  }
}
