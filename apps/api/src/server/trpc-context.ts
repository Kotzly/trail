import { db } from "@trail/db";
import type { AppContext } from "@trail/trpc";

export async function createTRPCContext(req?: Request): Promise<AppContext> {
  return {
    db,
    session: null,
    headers: req?.headers ?? new Headers()
  };
}
