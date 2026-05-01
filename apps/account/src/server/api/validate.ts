import { z } from "zod";

export function parseBody<T extends z.ZodType>(
  schema: T,
  data: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: result.data };
}

export function parseQuery<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams,
): { ok: true; data: z.infer<T> } | { ok: false; error: z.ZodError } {
  return parseBody(schema, Object.fromEntries(searchParams.entries()));
}
