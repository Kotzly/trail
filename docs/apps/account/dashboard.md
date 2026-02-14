# Account App: Dashboard

**Scope:** `apps/account/` (`app.gettrail.net`)  
**Purpose:** Authenticated app shell for trails, billing, and settings.

## File map
- App layout: `apps/account/app/(app)/layout.tsx`
- Dashboard: `apps/account/app/(app)/dashboard/page.tsx`
- Trails: `apps/account/app/(app)/trails/page.tsx`
- Settings: `apps/account/app/(app)/settings/page.tsx`

## Navigation
- Main nav includes: `/trails`, `/settings`.
- Legacy `/extension` and session manager pages are removed.
- Auth gate uses `trail_auth_session`; redirects through `/auth/login` and `/auth/refresh`.
