# API App: tRPC

**Scope:** `apps/api/` — api.gettrail.net  
**Purpose:** tRPC router and HTTP handler; protected procedures for authenticated users.

---

## File Map

| Role | Path |
|------|------|
| Route handler | `apps/api/app/api/trpc/[trpc]/route.ts` |
| Context | `apps/api/src/server/trpc-context.ts` |
| User/session | `apps/api/src/server/user.ts` |
| Router (shared) | `packages/trpc/src/router.ts` |
| tRPC init (shared) | `packages/trpc/src/trpc.ts` |
| Types (shared) | `packages/trpc/src/types.ts` |

---

## Interfaces

### Router (packages/trpc)

```ts
// router.ts
export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, timestamp: ... })),
  me: protectedProcedure.query(({ ctx }) => ({ user: ctx.session?.user ?? null })),
});

export type AppRouter = typeof appRouter;
```

- **publicProcedure** — no auth.  
- **protectedProcedure** — requires valid session (e.g. from Auth0 or JWT in context); ctx.session.user available.

### Context (API app)

- Built in trpc-context: session from cookie/header (e.g. getSession from Auth0), db client if needed.  
- Passed to procedures as `ctx`.

---

## Design Patterns

1. **Single router**  
   App router defined in packages/trpc; API app mounts it at `/api/trpc`; account app (and others) import AppRouter type and create typed client.

2. **Procedures**  
   Use publicProcedure for health/read-only public; protectedProcedure for me, billing, user mutations.

3. **HTTP**  
   Next.js App Router: [trpc]/route.ts creates tRPC handler (e.g. fetchAdapter); POST body is tRPC request.

---

## AI Agent Notes

- Add procedure: edit packages/trpc/router.ts; add input/output types; use in API context (session, db).  
- Account app: use @trail/trpc client with AppRouter type; baseURL to api.gettrail.net; send cookies or bearer token for protected calls.
