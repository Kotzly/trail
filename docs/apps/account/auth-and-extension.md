# Account App: Auth and Extension Login

**Scope:** `apps/account/` — app.gettrail.net  
**Purpose:** Better Auth SSO; extension login via one-time codes and token exchange; internal API calls from account to API app.

---

## File Map

| Role | Path |
|------|------|
| Auth session helper | `apps/account/src/lib/auth.ts` |
| Extension auth (JWT create/verify) | `apps/account/src/server/extension-auth.ts` |
| Extension login (code create, exchange) | `apps/account/src/server/extension-login.ts` |
| Internal API client | `apps/account/src/server/internal-api.ts` |
| Exchange route (extension gets token) | `apps/account/app/api/extension/exchange/route.ts` |
| User session | `apps/account/src/server/user.ts` |

---

## Interfaces

### Extension token (extension-auth.ts)

```ts
type ExtensionTokenPayload = {
  sub: string;   // userId
  iat: number;
  exp: number;
};

createExtensionAccessToken(userId: string, ttlSeconds?: number): { token: string; expiresAt: string }
verifyExtensionAccessToken(token: string): ExtensionTokenPayload | null
```

- JWT HS256; secret from `TRAIL_EXTENSION_JWT_SECRET`; base64url encoding.

### Extension login code

- Account app calls internal API (API app) to create code: POST with userId, optional preferredCode; API returns `{ code }`. Code is one-time, time-limited; stored in DB (ExtensionLoginCode).

### Exchange flow

1. User signs in on app.gettrail.net (Better Auth).  
2. User opens extension “link account” flow; extension shows code input or QR/link.  
3. User goes to account app extension page; enters code (or app generates code for user to type in extension).  
4. Account app calls internal API to create/validate code and associate with user.  
5. Extension calls account app exchange route with code; account app validates code with API, creates JWT, returns token to extension.  
6. Extension stores token; uses it for authenticated requests to API.

---

## Design Patterns

1. **Internal API**  
   Account app uses internal-api client to call API app (api.gettrail.net) with internal key header; API validates key (`requireInternalKey`). Used for create-login-code, ensure user, etc.

2. **Exchange route**  
   POST `/api/extension/exchange`: body has code (and maybe client_id); verify code via API or local DB, create JWT with createExtensionAccessToken, return { token, expiresAt }.

3. **Better Auth**  
   Session from Better Auth; user id is mapped to DB User; extension token sub = userId (cuid).

---

## Env

- Account: Better Auth vars; `TRAIL_EXTENSION_JWT_SECRET` for signing.  
- API: internal key for account→API calls; extension login code creation.

---

## AI Agent Notes

- New internal endpoint: add route in API app, protect with requireInternalKey; call from internal-api in account app.  
- Token claims: extend payload in extension-auth and document for extension; extension should validate exp and sub.
