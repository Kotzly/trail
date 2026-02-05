# PRD: Account Settings (profile, export, delete)

**Product:** Trail account app  
**Scope:** app.gettrail.net settings (profile, data export, delete account)  
**Status:** Living doc

---

## 0. Ivan decisions (v0)

- Username/nickname is not needed.
- Settings required: avatar, first name, last name, email (from OAuth).
- Must support: export user data and delete account.

---

## 1. Goals & Success

### 1.1 Goals

- Provide a single place to view and manage account profile fields tied to Better Auth.
- Allow editing first/last name and avatar while keeping OAuth as the source of truth.
- Make email visible but read-only in-app; redirect changes to Better Auth.
- Provide self-serve, versioned data export covering all Trail-owned data.
- Provide a secure, irreversible delete account flow that removes Better Auth user, Trail DB data, and extension access.

### 1.2 Success metrics

- Profile updates succeed on first attempt with clear feedback and no silent failures.
- Export requests complete successfully and are delivered within minutes (or with a clear async timeline).
- Delete requests complete end-to-end (Better Auth + Trail DB + access revocation) within 24 hours.

---

## 2. Existing context to reuse

- Settings page lives at `apps/account/app/(app)/settings/page.tsx` and renders Better Auth profile values.
- Better Auth session helper lives at `apps/account/src/lib/auth.ts`.
- Account app calls API app via internal key in `apps/account/src/server/internal-api.ts` and `/api/trpc/[trpc]` proxy.
- API app upserts `User` from Better Auth in `apps/api/src/server/user.ts`.
- DB schema currently includes `User` and `ExtensionLoginCode` only (`packages/db/prisma/schema.prisma`).
- Extension access tokens are JWTs created in `apps/account/src/server/extension-auth.ts`.

Implication: editable profile fields must not be overwritten by the Better Auth upsert on every login.

---

## 3. User Flows

### 3.1 View profile

1. Signed-in user opens `/settings`.
2. Server loads Better Auth session and renders profile card.
3. Profile shows avatar, first name, last name, email, and Better Auth source note.
4. """Manage in Better Auth""" link opens Better Auth profile page.
5. """Sign out""" is available (existing behavior).

### 3.2 Edit name + avatar

1. User clicks """Edit profile""".
2. Form shows first name, last name, avatar upload (current values prefilled).
3. User updates fields and clicks """Save""".
4. Server route updates Better Auth user profile via Management API.
5. App updates session and re-renders settings with new values.
6. If Better Auth update fails, show error and keep prior values.

Notes:
- If provider does not support profile update, show """Manage in Better Auth""" fallback.
- Avatar upload should store the resulting URL in Better Auth `picture`.

### 3.3 Email handling (read-only)

1. Email is displayed but disabled for editing.
2. """Change email in Better Auth""" link opens Better Auth user profile.
3. On next login or session refresh, email updates from Better Auth.

Decision: email edits remain out-of-app to avoid verification flows in Trail.

### 3.4 Export user data

1. User clicks """Export data""".
2. Confirmation modal explains data scope and format.
3. User confirms; export job starts.
4. UI shows progress (or """We will email you when ready""").
5. User receives a download link or immediate download of a `.zip` file.

### 3.5 Delete account

1. User clicks """Delete account""".
2. Warning modal describes irreversible effects and data retention.
3. User re-authenticates (Better Auth prompt=login) and types `DELETE`.
4. User confirms deletion.
5. System revokes access, schedules data deletion, and signs the user out.

---

## 4. Data Export

### 4.1 Data included

| Category | Notes |
|----------|-------|
| Account profile | Better Auth user id, email, name, avatar URL, createdAt. |
| Settings | Notification preferences, workspace flags, app preferences (current + future). |
| Trails/trees | All cloud-synced trees and nodes; includes tags and metadata. |
| Tags | Tag definitions and usage counts (if stored separately). |
| Share links | Share link metadata (id, createdAt, source tree, visibility). |
| Devices/sessions | Known devices and last seen data (no tokens). |
| Billing/subscription | Plan metadata if/when billing is enabled. |

Excluded: secrets (extension JWTs), internal keys, server logs, and third-party audit logs.

### 4.2 Export package format

- File format: `.zip`
- Root includes a `manifest.json` with versioning and checksums.
- Large datasets are split into multiple JSON files.

Example manifest:

```json
{
  "schema": "trail.account-export.v1",
  "exportedAt": "2026-01-30T00:00:00.000Z",
  "accountId": "user_cuid",
  "files": [
    { "path": "account.json", "schema": "trail.account.v1", "sha256": "..." },
    { "path": "settings.json", "schema": "trail.settings.v1", "sha256": "..." },
    { "path": "trees/tree-1.json", "schema": "trail.export.v1", "sha256": "..." },
    { "path": "share-links.json", "schema": "trail.share-links.v1", "sha256": "..." }
  ]
}
```

### 4.3 Versioning

- Export bundle: `trail.account-export.v1`.
- Tree payloads reuse existing `trail.export.v1` schema (see share-trails PRD).
- Each file declares its own `schema` for forward compatibility.

---

## 5. Delete Account Semantics

### 5.1 What gets deleted

- **Better Auth user:** delete via Better Auth Management API by Better Auth user id.
- **Trail DB:** user record, login codes, settings, shares, trails, tags, and any linked data.
- **Extension access:** revoke or invalidate extension JWTs and login codes.

### 5.2 Retention and irreversibility

- Immediate: sign user out and block new sessions.
- Data deletion: queued and completed within 24 hours.
- Backups/audit logs: retained for a short window (e.g., 30 days) before permanent purge.
- After completion, deletion is irreversible.

### 5.3 Irreversible confirmation

- Require re-authentication via Better Auth.
- Require typed confirmation (`DELETE`).
- Provide option to export data before deletion.

### 5.4 Revoking extension access

- Extension tokens are JWTs (HS256) created in `apps/account/src/server/extension-auth.ts`.
- Deletion must invalidate existing tokens by one of:
  - Token version in DB checked on every API request, or
  - Revocation list / blacklist, or
  - Secret rotation (coarse-grained; affects all users).

At minimum, after deletion the API must reject calls for deleted users.

---

## 6. Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| Better Auth session missing or expired | Redirect to login; preserve returnTo=/settings. |
| OAuth profile missing name or avatar | Show fallback initials and """trail member""". |
| Provider does not allow profile edits | Disable edit and show """Manage in Better Auth""" link. |
| Better Auth Management API rate limited | Retry with backoff; surface """Try again later""". |
| Export requested with no trails | Return export with empty datasets + metadata. |
| Export exceeds size/time limits | Switch to async job; email download link. |
| Delete requested while export in progress | Warn; allow export to finish or cancel. |
| Delete fails in Better Auth but succeeds in Trail DB | Mark account as """deletion pending""" and retry Better Auth. |
| Extension token still valid after delete | API rejects requests; extension prompts re-link. |

---

## 7. Technical Constraints

- **Better Auth:** account app reads session via Better Auth Next.js SDK (`getSession` / `Better AuthClient`). Profile updates and deletes require Better Auth Management API (server-side only).
- **Next.js App Router:** settings page is a server component; server actions or route handlers live in `app/api/.../route.ts` and should use `runtime = "nodejs"` for secret access.
- **Internal API:** account app does not access DB directly; it calls API app via `internalApiFetch` and `/api/trpc/[trpc]` proxy with `TRAIL_INTERNAL_API_KEY`.
- **Data model:** current DB only stores `User` and `ExtensionLoginCode`; exporting trails, tags, shares will require new tables or external storage lookups.
- **Security:** export/download links must be short-lived and scoped to the authenticated user; avoid exposing tokens in exports.

---

## 8. Out of Scope (current)

- Username/nickname fields.
- Team workspaces and roles.
- In-app email change and verification.
- Local-only extension data export (unless synced to cloud).
- Immediate removal from backups or third-party logs.
