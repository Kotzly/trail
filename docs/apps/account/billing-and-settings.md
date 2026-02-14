# Account App: Billing and Settings

**Scope:** `apps/account/` (`app.gettrail.net`)  
**Purpose:** Billing routes + local account settings UI.

## File map
- Billing API routes: `apps/account/app/api/v1/billing/**`, `apps/account/app/api/v1/subscription/**`
- Billing wrappers: `apps/account/app/api/billing/**`
- Settings page: `apps/account/app/(app)/settings/page.tsx`
- Local account profile page: `apps/account/app/auth/account/page.tsx`
- Sign out button: `apps/account/app/(app)/SignOutButton.tsx`

## Behavior
- Settings `manage` link points to local `/auth/account`.
- Sessions/devices manager UI is removed from settings.
- Sign out sends `AUTH_REVOKED` to extension bridge and calls `POST /auth/logout`.
- Billing checkout/cancel/resume wrappers call local `/api/v1` handlers (no internal proxy layer).
