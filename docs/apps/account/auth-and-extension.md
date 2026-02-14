# Account App: Auth and Extension

**Scope:** `apps/account/` (`app.gettrail.net`)  
**Purpose:** Single runtime for web auth + API + extension portal flow.

## File map
- Auth runtime: `apps/account/src/auth.ts`
- Auth API handler: `apps/account/app/api/auth/[...all]/route.ts`
- JWT cookie auth helper: `apps/account/src/lib/auth.ts`
- Portal backend: `apps/account/src/server/backend/portal-sessions.ts`
- Portal API: `apps/account/app/api/v1/auth/portal/**`
- Portal callback page: `apps/account/app/auth/portal/complete/page.tsx`
- Logout + extension revoke: `apps/account/app/auth/logout/route.ts`

## Contracts
- Better Auth issuer/JWKS: `https://app.gettrail.net` and `/api/auth/jwks`
- Extension portal start: `POST /api/v1/auth/portal`
- Portal poll: `GET /api/v1/auth/portal/{id}`
- Portal approve: `POST /api/v1/auth/portal/{id}/approve`
- Portal callback URL: `/auth/portal/complete`
- Web logout revokes extension tokens on server and clears `trail_auth_session`.

## Notes
- `trail_auth_session` remains the bearer cookie for account web/API flows.
- Legacy `/extension` route and connect/session manager flows are removed.
- Legacy domains (`api.gettrail.net`, `auth.gettrail.net`) are not part of runtime.
