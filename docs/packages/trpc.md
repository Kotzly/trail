# Packages: tRPC

**Scope:** `packages/trpc/`  
**Purpose:** Shared tRPC router, procedures, and types; used by API app (server) and account app (client).

---

## File Map

| Role | Path |
|------|------|
| Router | `packages/trpc/src/router.ts` |
| tRPC init | `packages/trpc/src/trpc.ts` |
| Types | `packages/trpc/src/types.ts` |
| Index | `packages/trpc/src/index.ts` |

---

## Interfaces

### Router

```ts
import { router, publicProcedure, protectedProcedure } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, timestamp: new Date().toISOString() })),
  me: protectedProcedure.query(({ ctx }) => ({ user: ctx.session?.user ?? null })),
});

export type AppRouter = typeof appRouter;
```

### Procedures

- **publicProcedure** — no auth requirement.  
- **protectedProcedure** — ctx.session must be set (enforced in tRPC context in API app).

### Context (server-side)

- Defined in API app (trpc-context.ts); not in package. Package only defines router and procedure builders; context type may be in types.ts (e.g. optional session).

---

## Design Patterns

1. **Router in package**  
   Single appRouter; API app creates context and passes to createCaller or HTTP handler; account app uses createTRPCReact<AppRouter> or similar for typed client.

2. **Input validation**  
   Use zod or similar in procedure input for publicProcedure.query(({ input }) => ...) and mutations.

---

## AI Agent Notes

- Add procedure: router({ ...existing, newOne: protectedProcedure.input(z.object({...})).mutation(...) }).  
- Context type: ensure packages/trpc types.ts Context has session optional; API app implements it with real session.
