# PRD: User Flow Redesign (auth gate, editor mode, site+extension side-by-side)

**Product:** Trail extension + app.gettrail.net + gettrail.net  
**Scope:** Auth gate in extension, simplified account site, editor mode (extension + site), tree operations, API prefix migration  
**Status:** Approved (living doc)

---

## 0. Ivan decisions (v0)

- Extension without account is **dead** — auth gate blocks everything, graph not rendered until login.
- Extension = **source of truth** for trees. Site sends commands to extension; extension applies and syncs to cloud.
- Logout **only through account site** — intentional protection from accidental signout.
- Site and extension work **side by side**: trail list on site, visual canvas in extension, node inspector on site.
- Settings split: **visual** (theme, layout, display) in extension; **everything else** (account, billing, sessions, advanced) on site.
- **Editor mode**: only for past/closed trees. Live (growing) tree cannot be edited.
- Node notes: **Markdown** with preview.
- Auto-save: every change persisted automatically (no explicit save button).
- Sync: **debounce** (3–5 sec after last change).
- Past trees storage: **cloud + cache N recent** locally in extension (LRU, default 10).
- Drag on empty space: **cancel** (return to place). "Detach to new tree" via context menu — later.
- Delivery model: **direct postMessage with retry** (no backend queue). 3 attempts, 1s/2s/4s backoff.
- postMessage security: **Zod** schema validation + **TTL** (30s) + **nonce** anti-replay (Set of 100) + strict origin whitelist.
- API prefix: migrate from `/v1/*` to `/api/v1/*`.

---

## 1. Goals & Success

### 1.1 Goals

- **Onboarding**: user installs extension from landing → signs in → starts using immediately.
- **Auth gate**: extension is unusable without authentication. Zero anonymous usage.
- **Editor mode**: user can edit past trees visually in extension while viewing details on site.
- **Side-by-side**: site = trail list + node inspector + settings; extension = graph canvas + visual preferences.
- **Tree operations**: drag reparent, delete subtree, duplicate subtree, undo/redo.
- **Security**: postMessage protocol validated, replay-protected, origin-restricted.

### 1.2 Success metrics

- Onboarding completion (install → sign in → first tree) >80%.
- Editor mode activation (click edit → extension enters editor) latency <1s.
- postMessage ACK success rate >99% (within 3 retries).
- Zero auth mismatch states reaching the user without clear messaging.

---

## 2. Non-goals (v0)

- Table/list view of nodes on site.
- Timeline view.
- Bulk operations on nodes.
- "Detach to new tree" operation.
- Real-time collaborative editing.
- Command palette (Ctrl+K).
- Mini-map for large trees.
- Mobile editing.
- Merge branches.
- HMAC/signature for postMessage (same-tab, not network).

---

## 3. Personas / User Stories

### 3.1 Personas

- **New user**: discovers Trail, installs extension, signs in for the first time.
- **Active user**: browses daily, reviews past trails, occasionally edits tree structure.
- **Power user**: heavily edits trees — reparents branches, adds notes, curates structure.

### 3.2 Key user stories

- "I installed the extension and want to start using it immediately."
- "I want to see my past trails on the website and pick one to edit."
- "I want to drag a branch to a different parent in the graph."
- "I want to add notes and tags to a specific page I visited."
- "I want to sign out from the website and have the extension sign out too."

---

## 4. Terminology

- **Auth gate**: full-screen blocker in extension, shown when not authenticated.
- **Editor mode**: extension mode for editing a past tree. Disables follow-active-tab.
- **Node Inspector**: panel on account site showing details of the selected node.
- **Portal flow**: existing mechanism where extension opens a tab to account site for authentication.
- **Source of truth (SoT)**: extension holds authoritative tree state; site sends commands.

---

## 5. Existing mechanisms to reuse

### 5.1 Portal auth flow (extension ↔ account site)

- Extension creates portal session → opens `app.gettrail.net/extension`
- Polls `/auth/portal/{sessionId}` every 3 seconds
- On approval, receives `AccountSnapshot` with tokens
- Tokens stored in `chrome.storage.local`

Ref: `extension/src/account/useAuthPortalFlow.ts`

### 5.2 postMessage handshake (site → extension)

- Content script listens for `{ source: "trail-site", type: "OPEN_TRAIL_PANEL" }`
- Origin validated against `ALLOWED_ORIGINS`
- ACK with `requestId` echo
- Ref: `extension/src/content/content-script.ts`, `apps/marketing/app/lib/trail-extension.ts`

### 5.3 Extension ↔ API communication

- Extension → `app.gettrail.net/v1/*` (proxy) → `api.gettrail.net`
- Auth: Bearer token (extension JWT)
- Proxy uses `x-trail-internal-key` for internal auth
- Ref: `extension/src/shared/config/backend.ts`, `apps/account/src/server/internal-api.ts`

### 5.4 Tree storage

- Local: `chrome.storage.local` (live tree + cached past trees)
- Cloud: `Trail.payload` JSON in Postgres (synced via `/v1/trails/sync`)
- Ref: `extension/src/background/services/tree-storage.ts`, `packages/db/prisma/schema.prisma`

---

## 6. User Flows

### 6.1 Onboarding (new user)

1. User visits `gettrail.net` (landing).
2. Single CTA: "Add to Chrome" (adaptive text for Brave/Edge/Arc by user-agent).
3. Firefox/Safari: "Join Waitlist" as secondary.
4. User installs extension, opens side panel.
5. **Auth gate**: full-screen — Trail logo, "Sign in to start", "Continue with Google" button.
6. User clicks → extension opens `app.gettrail.net` via portal flow.
7. Account site `/auth` page: minimal — logo + "Continue with Google" button.
8. Google OAuth completes → callback detects portal origin → shows "You're all set!".
9. Extension polling picks up token → auth gate disappears → graph starts.
10. If user navigated to account site directly (not from extension) → redirect to `/trails`.

### 6.2 Viewing trails (account site)

1. User opens `app.gettrail.net`.
2. If not logged in → redirect to `/auth`.
3. If logged in → `/trails`: card grid of saved trails.
4. Each card: label, node count, root favicon + title, last updated, device.
5. Actions per card: Edit (pencil icon), Delete (confirmation), Export (JSON).
6. Search bar + date range filter.

### 6.3 Entering editor mode

1. User on `/trails/[id]` clicks "Edit in Extension".
2. Site sends `PING` → checks extension is present and authenticated.
3. If `PONG.authenticated === false` → show "Sign in to extension first" + portal flow trigger.
4. If `PONG` → site sends `ENTER_EDITOR_MODE { treeId }`.
5. Extension loads tree (from cache or API), switches to editor mode.
6. Extension sends `EDITOR_MODE_ENTERED { treeId, treeState }` to site.
7. Site shows Node Inspector panel.

### 6.4 Editing in editor mode

**In extension (graph canvas):**
- Drag reparent: grab node → ghost preview → snap to candidate parent → drop.
- Delete subtree: context menu → confirmation → delete.
- Duplicate subtree: context menu → clone with new IDs → sibling.
- Undo/redo: Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac).
- Each operation → push to undo stack → mark dirty → debounce sync.

**On site (Node Inspector):**
- Select node in extension → site shows details.
- Edit: title, notes (Markdown), tags.
- Save → `UPDATE_NODE_METADATA` → extension applies → undo stack → sync.

**Sync:**
- Auto-save: 3–5s debounce after last change.
- Visual: "Saving..." → "Saved" in editor toolbar.
- On exit editor mode: force immediate sync.
- Network failure: retry 3x (2s/4s/8s) → "Sync failed" + manual retry.

### 6.5 Exiting editor mode

- Click "Exit editor" in extension toolbar.
- Or navigate away from `app.gettrail.net` → auto-exit.
- Extension sends `EDITOR_MODE_EXITED` to site.
- If dirty → force sync before exit.
- Extension returns to live graph mode.

### 6.6 Logout

1. User opens extension Settings → Account → "Account Settings" → opens `app.gettrail.net/settings`.
2. On site: Settings → "Sign out".
3. Site clears cookie + sends `AUTH_REVOKED` via postMessage.
4. Extension receives → clears stored tokens → shows auth gate.
5. If postMessage fails (extension not on same tab) → extension discovers on next API call (401) → auth gate.

---

## 7. UX & Interaction details

### 7.1 Auth gate (extension)

- Full-screen, blocks all UI. Graph components **not mounted** (conditional render, not overlay).
- Trail logo (centered), "Sign in to start" text, "Continue with Google" button.
- After clicking: spinner state while portal flow completes.

### 7.2 Login page (account site)

- `/auth/page.tsx` with `/auth/layout.tsx` (minimal, no nav header, centered).
- Trail logo, "Continue with Google" button. Nothing else.
- `/auth/login/route.ts` (existing redirect to Better Auth) — unchanged.

### 7.3 Drag reparent UX

- **Grab**: long press (150ms) or modifier+click on node.
- **Detach**: connection line to parent breaks, node lifts slightly (scale 1.05, shadow).
- **Drag**: ghost preview (semi-transparent subtree) follows cursor.
- **Snap**: within ~50–80px (zoom-adjusted) of a candidate parent:
  - Candidate glows (highlight color).
  - Dashed connection line from candidate to dragged node.
- **Invalid target**: descendants of dragged node → no-drop cursor, no snap.
- **Drop on valid**: reparent, animated layout recalculation.
- **Drop on empty**: cancel, node returns to original position with spring animation.

### 7.4 Editor toolbar

- Strip at top of side panel: `"Editing: [tree name]" | [Undo] [Redo] | "Saved" | [Exit]`
- Subtle background to distinguish from normal mode.
- Undo/Redo buttons: disabled when stack empty.
- Save status: "Saving..." (spinner) → "Saved" (checkmark, fades after 2s) → "Sync failed" (red, persistent + retry).

### 7.5 Node Inspector (site)

- Panel appears when extension sends `NODE_SELECTED`.
- Read-only: URL (clickable), favicon, timestamps, children count, depth.
- Editable: title (text input), notes (Markdown editor + live preview), tags (tag picker with create).
- Save button per field or auto-save on blur.

---

## 8. postMessage Protocol

### 8.1 Security layer

All messages must comply:

- **Zod schema validation**: each message type has a Zod schema. `safeParse()` on receive; reject invalid.
- **TTL**: `timestamp` field (ms since epoch). Reject if `Date.now() - timestamp > 30_000`.
- **Nonce**: `requestId` (UUID v4). Extension stores Set of last 100 IDs. Reject duplicates.
- **Origin whitelist**: strict — only explicit entries in `ALLOWED_ORIGINS`. No broad `localhost` hostname fallback.

### 8.2 Base message schema

```typescript
const SiteMessageBase = z.object({
  source: z.literal("trail-site"),
  type: z.string(),
  requestId: z.string().uuid(),
  timestamp: z.number(),
});
```

### 8.3 Message types

**Site → Extension (ACK-required):**

| Type | Payload | ACK |
|---|---|---|
| `PING` | — | `PONG { version, authenticated, editorMode }` |
| `ENTER_EDITOR_MODE` | `{ treeId }` | `EDITOR_MODE_ENTERED { treeId, treeState }` |
| `EXIT_EDITOR_MODE` | — | `EDITOR_MODE_EXITED` |
| `SELECT_NODE` | `{ nodeId }` | `NODE_SELECTED { nodeId, nodeData }` |
| `UPDATE_NODE_METADATA` | `{ nodeId, title?, notes?, tags? }` | `NODE_METADATA_UPDATED { nodeId }` |

**Site → Extension (fire-and-forget):**

| Type | Payload | Notes |
|---|---|---|
| `AUTH_REVOKED` | — | Extension clears tokens, shows auth gate |

**Extension → Site (no ACK):**

| Type | Payload | Notes |
|---|---|---|
| `NODE_SELECTED` | `{ nodeId, nodeData }` | User selected node in graph |
| `TREE_UPDATED` | `{ treeId, patch }` | Tree changed after operation |
| `EDITOR_MODE_EXITED` | — | Extension left editor mode |

### 8.4 Retry logic (site-side)

- ACK-required messages: wait up to 3s for ACK.
- If no ACK: retry up to 3 times with 1s/2s/4s backoff.
- If all retries fail: UI error "Extension not responding. Try reopening the side panel." + retry button.

### 8.5 Content script routing

- `window.addEventListener("message")` → Zod validate → TTL check → nonce check → origin check.
- Valid site→extension messages → `chrome.runtime.sendMessage()` to background.
- Background → side panel via existing messaging router.
- Extension→site messages: background → content script → `window.postMessage()`.

---

## 9. Auth Parity

### 9.1 States

| Site | Extension | Editor mode | Action |
|---|---|---|---|
| Logged in | Logged in | Available | Normal operation |
| Logged in | Not logged in | Blocked | "Sign in to extension" message + portal flow |
| Not logged in | Logged in | N/A | Site shows `/auth` page |
| Not logged in | Not logged in | N/A | Both show login prompts |

### 9.2 Invariants

- **Edit button disabled** if `PONG.authenticated === false`.
- **Logout propagation**: site logout → `AUTH_REVOKED` → extension auth gate.
- **Fallback**: if `AUTH_REVOKED` not delivered (different tab), extension discovers on next API 401.
- **No silent mismatch**: editor mode **never starts** without confirmed auth parity.

---

## 10. API Boundary

### 10.1 Architecture (unchanged pattern, new prefix)

```
Extension / Site
      │
      │ HTTPS (Bearer token or cookie)
      ▼
apps/account (app.gettrail.net)
  /api/v1/* proxy routes
      │
      │ internalApiFetch() + x-trail-internal-key
      ▼
apps/api (api.gettrail.net)
  /api/v1/* business logic
```

### 10.2 Prefix migration

- Old: `/v1/*`
- New: `/api/v1/*`
- Migration: move route files, update extension `backend.ts` `basePath`, add temporary 308 redirect shim.

### 10.3 New endpoints (v0)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/trails` | Bearer/Cookie | List trails (paginated, search, sort) |
| `GET` | `/api/v1/trails/:id` | Bearer/Cookie | Single trail with metadata |
| `PATCH` | `/api/v1/trails/:id` | Bearer/Cookie | Update trail metadata (label, description) |
| `DELETE` | `/api/v1/trails/:id` | Bearer/Cookie | Soft-delete trail |

Proxy routes in `apps/account/app/api/v1/trails/` forward to `apps/api`.

### 10.4 Auth for site vs extension

- **Extension**: Bearer token in `Authorization` header (existing).
- **Site**: httpOnly cookie (`trail_auth_session`). Proxy routes resolve user from cookie for site requests, from Bearer for extension requests.

---

## 11. Settings Split

### 11.1 Extension (visual, instant feedback)

- Layout mode (Mindmap / Tree / Radial) + tuning (gaps, angles)
- Appearance (Theme picker, density, truncation)
- Display toggles (favicons, URLs, tag dots, tab counts, audio, connections, dim closed)
- Theme Studio (custom colors)

### 11.2 Account site (account, advanced, billing)

- `/settings` — name, email, avatar, **Sign out** button
- `/settings/sessions` — active devices, revoke sessions
- `/settings/advanced` — tab limit, tree capacity, confirm new tree, keyboard shortcuts toggle
- `/settings/billing` — (Polar PRD, separate task)

### 11.3 Extension → site link

- Extension Settings → Account section → single link: "Account Settings" → opens `app.gettrail.net/settings`
- No sign-out button in extension.

---

## 12. Edge Cases & Handling

| Case | Behavior |
|---|---|
| No extension on account site | All pages work read-only. Editor mode unavailable. Banner "Install Trail extension to edit" + CWS link |
| Unsupported browser (Firefox, Safari) | Landing: "Join Waitlist". Account site: "Currently Chrome/Edge only" + waitlist |
| Extension installed but disabled | Same as "no extension" (PING timeout after 2s) |
| Token expired (extension) | API returns 401 → extension shows auth gate |
| Token expired (site) | Middleware redirects to `/auth` |
| Auth mismatch: site yes, extension no | Edit button disabled. "Sign in to extension" inline message |
| Offline | Extension: works locally, no sync. Site: "No connection" banner |
| User in editor mode, navigates other tab | Live tree grows in background. Editor mode unaffected |
| Google OAuth cancelled | `/auth` page shows "Try again" |
| Mobile access | Read-only trail list. No editor mode. "Desktop only for editing" |
| Extension update mid-editor | Service worker restarts → reload tree from cache → re-enter editor |
| Concurrent edit from 2 devices | Last-write-wins for v0 (extension = SoT per device) |
| postMessage ACK timeout (3 retries) | UI: "Extension not responding. Try reopening the side panel." + retry |
| Replay attack (duplicate requestId) | Nonce Set rejects, message dropped |
| Stale message (>30s) | TTL check rejects, message dropped |
| Large tree (>10k nodes) | Editor mode loads progressively. Consider LOD (existing) for rendering |

---

## 13. Technical Constraints

- **MV3 service worker**: may suspend. Tree state must survive restart (persist to `chrome.storage`).
- **chrome.sidePanel**: opens only from user gesture or `chrome.sidePanel.open()`. Cannot force-open from postMessage alone.
- **Content script injection**: `document_start` on all URLs. Must be loaded before postMessage works.
- **ALLOWED_ORIGINS**: must include `app.gettrail.net` and dev URLs. No broad hostname fallback.
- **Zod bundle size**: content script should use minimal Zod (or precompiled schemas) to avoid bloat.
- **Cookie vs Bearer auth**: proxy routes must handle both. Site sends cookie, extension sends Bearer.

---

## 14. Implementation Phases

### Phase 0: Foundation
- 0a: API prefix migration (`/v1/*` → `/api/v1/*`)
- 0b: postMessage security layer (Zod + TTL + nonce)

### Phase 1: Auth Gate + Login
- 1a: Extension auth gate (full-screen blocker)
- 1b: Account site login page (`/auth/page.tsx`)
- 1c: Marketing CTA simplification
- 1d: Auth parity (PING/PONG, AUTH_REVOKED, mismatch handling)

### Phase 2: Trails Management
- 2a: API endpoints (list, get, patch, delete)
- 2b: Trails list page
- 2c: Trail detail page

### Phase 3: Editor Mode — Extension
- 3a: Mode management (Zustand state, enter/exit)
- 3b: Drag reparent
- 3c: Delete + duplicate subtree
- 3d: Undo/redo command stack
- 3e: Editor toolbar

### Phase 4: Editor Mode — Site
- 4a: postMessage protocol (new message types, retry logic)
- 4b: Node Inspector (details, Markdown notes, tags)
- 4c: Extension detection (PING/PONG probe)

### Phase 5: Settings Reorganization

### Phase 6: Caching + Sync
- 6a: LRU tree cache in extension
- 6b: Debounce sync with retry

---

## 15. Open Questions (remaining)

None — all questions resolved during planning. New questions should be added here as they arise during implementation.
