# Account App: Dashboard

**Scope:** `apps/account/` — app.gettrail.net  
**Purpose:** Post-login landing; overview and entry to settings, billing, extension link.

---

## File Map

| Role | Path |
|------|------|
| Page | `apps/account/app/(app)/dashboard/page.tsx` |
| Client component | `apps/account/app/(app)/dashboard/DashboardClient.tsx` |
| Layout | `apps/account/app/(app)/layout.tsx` (app shell) |
| App shell | `apps/account/app/components/AppShell.tsx` |
| Sidebar / TopBar | `apps/account/app/components/Sidebar.tsx`, `TopBar.tsx` |

---

## Design Patterns

1. **Server page**  
   Dashboard page may fetch session/server data and render DashboardClient with props or use tRPC in client.

2. **App shell**  
   Layout wraps (app) routes with AppShell (sidebar + main); TopBar for user menu/logout; Sidebar links to dashboard, settings, billing, extension.

3. **Dashboard content**  
   DashboardClient shows welcome, quick stats (if any), and links/cards to settings, billing, extension connection.

---

## AI Agent Notes

- tRPC: use `packages/trpc` router; account app has trpc client and provider; call `me` or custom procedures for dashboard data.  
- Copy: use `packages/content` account strings if defined.  
- Auth: dashboard under (app) is protected; redirect to login if no session.
