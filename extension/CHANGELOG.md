# Changelog

All notable changes to the Trail extension. Follows [Keep a Changelog](https://keepachangelog.com/)
and semver (via `chrome-v<semver>` git tags).

## [Unreleased]

## [1.1.1] — 2026-06-01

### Added

- Zen "Transparent background" setting (Firefox/Zen only) — opt-in toggle
  that makes the side panel's backdrop transparent so Zen's themed sidebar /
  workspace gradient shows through behind the tree. No Chrome-facing changes
  in this release.

## [1.1.0] — 2026-05-28

### Added

- Trail sharing. Open a trail's menu and choose "Share trail" to mint a
  `/s/<code>` link. Links are public by default or can be restricted to
  a specific email allowlist; owners can list, re-scope, and revoke their
  shares. Recipients import a copy into their own account. A one-time
  "what's new" dialog announces the feature to upgrading users.
- Firefox support. `pnpm build:firefox` / `pnpm zip:firefox` produce an
  AMO-ready Manifest V3 add-on (`extension@gettrail.net`, min Firefox 115).
  Toolbar icon toggles the sidebar via `sidebarAction.toggle`; the
  Chrome-only `sidePanel.setPanelBehavior` branch is tree-shaken out.
- Browser-aware favicon fallback. Chrome keeps using
  `chrome-extension://<id>/_favicon/` (gated by the `favicon` permission);
  Firefox falls back to the origin's `/favicon.ico`.

### Fixed

- Firefox telemetry now honors the AMO disclosure end-to-end. The
  manifest declares `technicalAndInteraction` as an optional
  `data_collection_permissions` entry; Sentry and PostHog init are
  gated on `browser.permissions.contains({ data_collection: [...] })`,
  and toggling Settings → Privacy on prompts Firefox for the
  permission via `browser.permissions.request(...)`. Revoking from
  `about:addons` tears the clients down mid-session.

## [1.0.0] — 2026-04-16

First public release. Ships the core graph-based browsing experience with
local-first storage, optional cloud sync, and a proper settings surface.

### Added

- Command palette (`⌘K` / `⌘F` / `/`) — instant search across every node
  plus quick actions (open settings, open first result in new tab).
- Node rename — inline via context menu "Rename…" or `F2` on the selected
  node. Full undo support.
- Onboarding wizard — 5-step walkthrough on first launch (welcome →
  how it works → permissions priming → load demo / start fresh →
  shortcuts cheat-sheet). Replay from Settings → About.
- Demo tree — realistic 33-node "Trip to Japan" research session to
  explore Trail without having to browse first.
- Settings overhaul — new pages: Account, Data, Shortcuts, Privacy,
  About. Each ships a dedicated concern (auth / data hygiene /
  keyboard reference / telemetry consent / version + feedback).
- Cloud sync (opt-in) — sign in with Google via `chrome.identity` +
  Supabase. Trees push to `trails` on mutation with 2 s debounce,
  LWW reconciliation against server `updated_at`, and a visible
  conflict banner when another device edits the same tree.
- Observability — Sentry for crash reports and PostHog for anonymous
  product analytics, both opt-out from Settings → Privacy, both with
  PII scrubbing on URLs and page titles.
- Accessibility baseline — correct role/aria on banners, focus rings,
  keyboard nav in command palette, prefers-reduced-motion respected.
- `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` at the package root
  for anyone approaching the repo.

### Changed

- Theme system — `data-theme` now always written as a resolved
  `"light" | "dark"` (never `"system"`), fixing a bug where picking
  "System" broke dark rendering. FOUC prevention script now reads a
  separate `trail_theme_choice` key so it can re-resolve against OS
  preference on every load.
- Transport — `@webext-core/messaging` + `proxy-service` throughout
  (migration completed pre-release); all cross-surface APIs typed.
- TypeScript config — `strict` + `noUncheckedIndexedAccess` kept on;
  `exactOptionalPropertyTypes` disabled due to shadcn/Radix prop
  spread incompatibility (see `tasks/lessons.md`).

### Fixed

- Broken search UI — `searchInputRef` was accepted but never rendered,
  so `⌘K` silently did nothing. Replaced with a real command palette.
- Tab LRU `remove()` — now finds next-most-recent tab instead of
  nulling `latestTabId`, so LRU survives tab close.
- `navigation-handler.ts` — honors `tab.pinned` when creating a new
  node (previously always set `pinned: false`).
- `commands.ts` — redo stack invalidated with `[]` instead of
  `slice(0, 0)` (same result, clearer intent).
- Sync indicator — was hardcoded to `"idle"`; now reflects real engine
  state via `SYNC_STATUS` events.

### Removed

- Dead deps: `elkjs` (layout replaced by `d3-hierarchy`), `shard`
  (typo of `shadcn`).
- `public/elk-worker.min.js` (no longer bundled).
- `graphify-out/` committed artifacts (now git-ignored).

### Infrastructure

- CI (`.github/workflows/ci-extension.yml`) runs lint + format:check
  + typecheck + test + build + Playwright E2E under xvfb.
- Release pipeline (`release-extension.yml`) packages the zip and
  uploads a draft to the Chrome Web Store on `chrome-v*` tags.
- Husky + lint-staged enforce eslint --fix and prettier on commit.
