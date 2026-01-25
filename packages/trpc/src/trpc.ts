import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { AppContext } from "./types";

const t = initTRPC.context<AppContext>().create({
  transformer: superjson
});

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session
    }
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(requireAuth);
