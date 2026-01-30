# API App: Internal API

**Scope:** `apps/api/` — api.gettrail.net  
**Purpose:** Internal-only routes for account app and services: extension login codes, user ensure, exchange; protected by shared internal key.

---

## File Map

| Role | Path |
|------|------|
| Internal auth | `apps/api/src/server/internal-auth.ts` |
| Extension login (create code) | `apps/api/src/server/extension-login.ts` |
| Login code route | `apps/api/app/api/internal/extension/login-code/route.ts` |
| Code exists | `apps/api/app/api/internal/extension/code-exists/route.ts` |
| Exchange | `apps/api/app/api/internal/extension/exchange/route.ts` |
| Portal (e.g. user by id) | `apps/api/app/api/internal/portal/[id]/route.ts` |
| Users ensure | `apps/api/app/api/internal/users/ensure/route.ts` |
| User by id | `apps/api/app/api/internal/users/[id]/route.ts` |

---

## Interfaces

### Internal auth

- Request must include header (e.g. `x-internal-key` or `Authorization`) with shared secret.  
- `requireInternalKey(requestHeaders)`: returns falsy if valid; returns NextResponse (401/403) if invalid. Use at top of each internal route.

### Extension login code

- **POST /api/internal/extension/login-code**  
  Body: `{ userId: string, preferredCode?: string }`. Creates ExtensionLoginCode in DB (code unique, expiresAt); returns `{ code: string }`. Called by account app.

- **GET/POST code-exists**  
  Check if code is valid (exists, not used, not expired); used by extension or account before exchange.

- **Exchange**  
  Consume code (mark used), return token or session; may live in API or account app (see account auth-and-extension.md).

### Users

- **POST /api/internal/users/ensure**  
  Body: auth0 or identity payload; ensure User exists (by auth0Id); return user id or user object. Used after Auth0 login.

- **GET /api/internal/users/[id]**  
  Return user by id; internal only.

---

## Design Patterns

1. **Key in env**  
   Internal key stored in env (e.g. `TRAIL_INTERNAL_API_KEY`); account app and API app both have it; account sends it on every internal request.

2. **Extension codes**  
   Stored in Prisma ExtensionLoginCode; code = random string; userId links to User; expiresAt; usedAt set when code is exchanged.

3. **Idempotent ensure**  
   ensure user: find by auth0Id; if not found, create; return user.

---

## AI Agent Notes

- Add internal route: new file under `app/api/internal/...`, call requireInternalKey, implement handler, document body/response.  
- Do not expose internal routes publicly; no public link to them; only server-to-server with key.
