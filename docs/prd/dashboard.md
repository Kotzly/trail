# PRD: Dashboard (app.gettrail.net)

**Product:** Trail account app  
**Scope:** app.gettrail.net — dashboard, settings, billing, extension link  
**Status:** Living doc

---

## 1. Goals & Success

- **Primary:** Signed-in user sees status (sync, sessions, trails) and can open extension, settings, billing.
- **Secondary:** Drive extension connection when no trails; clear path to profile and billing.
- **Success:** Session stability, extension page visits, settings/billing usage; low confusion on “what to do next.”

---

## 2. User Flows

### 2.1 Signed-in user → Dashboard (first time, no extension)

1. User lands on dashboard (or `/` with session → redirect to dashboard).
2. Sees **“Recent trails”** empty state: “No trails yet”, “Connect the extension to start…”.
3. Primary CTA: **“Connect extension”** → `/extension`.
4. Secondary CTA: **“Account settings”** → `/settings`.
5. Status section: sync “checking” / “no sync yet”; sessions/trails “0”.
6. Insights: placeholders “—” until trails exist.

### 2.2 Signed-in user → Dashboard (extension connected, no cloud trails yet)

1. Dashboard shows same “Recent trails” empty state or “0 trails” until first sync (future).
2. Status: sync “online” when API health is ok; sessions/trails may still be 0.
3. Links: Extension, Settings, Billing.

### 2.3 Signed-in user → Extension page (link browser)

1. Nav or dashboard CTA: **“Extension”** → `/extension`.
2. If not signed in → redirect to Better Auth login with `returnTo=/extension`.
3. Signed in: **“Status”** section — if no code in URL: empty state “Connect your browser”, CTA to start connection flow.
4. With `?code=...` in URL (from extension): server creates/uses login code for this user, shows “Connected” state.
5. Device section: primary device “Connected” / “—”, last seen “—” (or value when backend supports it).
6. Sessions section: “Coming soon” or empty list until multi-session is built.

### 2.4 Signed-in user → Settings

1. **Settings** → `/settings`.
2. Profile: name, email, avatar (Better Auth); “Manage in Better Auth” link; “Sign out”.
3. Security: change password, sessions (current session noted; “Sign out everywhere” coming soon).
4. No Trail-specific profile fields required for MVP.

### 2.5 Signed-in user → Billing

1. **Billing** → `/billing`.
2. See plan/status; “Manage billing” or “Upgrade” → Stripe Customer Portal (redirect).
3. Return URL back to app (e.g. `/billing`).

### 2.6 Sign-out

1. Settings or nav: **“Sign out”** → Better Auth logout + redirect to marketing or account landing.
2. Session cleared; next visit requires login.

---

## 3. Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| **No session (deep link to /dashboard or /extension)** | Redirect to login with `returnTo`; after auth, redirect back. |
| **Session expired mid-flow** | API/tRPC returns 401; show “Session expired” and redirect to login. |
| **tRPC/API down** | Dashboard: health check fails; show “checking” or error state; do not block render of static copy. |
| **Extension page with invalid or expired ?code=** | Create new code and redirect to `/extension?code=<newCode>` so extension can retry; or show “Link expired” and prompt to start again. |
| **User has no DB record (first Better Auth login)** | ensureUser creates User; then extension code can be created. |
| **Billing portal redirect fails or user closes** | User remains on /billing; can retry “Manage billing”. |
| **Better Auth bypass (e.g. dev)** | isAuthBypassed() allows access without session; extension page can still show; document only for dev. |
| **Empty “Recent trails” forever** | Copy explains “connect extension”; no dead-end. Stats (sessions, trails) show 0 or placeholder until backend provides. |
| **Very long display name** | Truncate or allow wrap in header/dashboard; fallback “trail member”. |

---

## 4. Technical Constraints

- **Stack:** Next.js (App Router), Better Auth, tRPC client to api.gettrail.net, `@trail/ui`, `@trail/content`. Vercel.
- **Auth:** Better Auth SDK; session in cookie. Protected routes: (app) layout checks session; redirect to login when missing.
- **Data:** tRPC `health`, `me`; dashboard stats (sessions, trails) from API when implemented. No direct DB access from app.
- **Extension codes:** Created via internal API (account → api.gettrail.net); account app calls POST internal/extension/login-code with userId.
- **Billing:** Stripe; portal session created server-side (v1 or tRPC); redirect to Stripe, return URL to /billing.
- **Copy:** All UI strings from `packages/content` (account); no hardcoded copy in app.
- **Layout:** App shell (sidebar + main) for all (app) routes; sidebar: Dashboard, Settings, Billing, Extension; top bar: user menu, sign out.

---

## 5. Out of Scope (current)

- Real “Recent trails” list from API (placeholder data or empty).
- Real sessions list and “last seen” from API.
- Onboarding checklist persistence (copy only).
- Team/workspace or invites.
- In-app billing plan change (only portal redirect).
