import { router, publicProcedure, protectedProcedure } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    timestamp: new Date().toISOString()
  })),
  me: protectedProcedure.query(({ ctx }) => ({
    user: ctx.session?.user ?? null
  }))
});

export type AppRouter = typeof appRouter;
