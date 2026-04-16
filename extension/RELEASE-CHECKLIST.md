# Release Checklist — Trail

Step-by-step verification before publishing to the Chrome Web Store. Every
item is a checkbox. Run through each section in order.

---

## 1. Version & tag

- [ ] `wxt.config.ts` `manifest.version` matches target release
- [ ] `package.json` `version` matches
- [ ] `CHANGELOG.md` has a section for this version
- [ ] `git tag chrome-v<version>` on the release commit

## 2. Automated verification

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (0 errors; warnings acceptable)
- [ ] `pnpm format:check` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds; total bundle < 5 MB
- [ ] `pnpm e2e` passes (smoke specs + any added specs)

Or run them all: `pnpm check && pnpm build && pnpm test && pnpm e2e`.

## 3. Manifest verification

Produced at `.output/chrome-mv3/manifest.json` after build.

- [ ] `"manifest_version": 3`
- [ ] `"version"` matches the `chrome-v*` git tag
- [ ] `"permissions"` is exactly: `sidePanel`, `storage`, `tabs`,
      `webNavigation`, `favicon`, `alarms`, `identity`
- [ ] No `scripting`, `<all_urls>` permission, `activeTab`, `bookmarks`,
      `offscreen`, or unused extras
- [ ] `"host_permissions"` is exactly:
      `https://gettrail.net/*`, `https://app.gettrail.net/*`
- [ ] No `http://` or `localhost` URLs in the production manifest
      (`grep -E 'localhost|127\.0\.0\.1|http://' .output/chrome-mv3/manifest.json`
      returns nothing)
- [ ] CSP has no `unsafe-eval` / `unsafe-inline`
      (default MV3 strict CSP; see `CSP-RATIONALE.md`)
- [ ] Only expected entrypoints ship:
      `sidepanel.html`, `settings.html`, `background.js`,
      `content-scripts/content.js`

## 4. Permissions justification (for Web Store reviewer)

Paste this into the store listing justification textarea:

- `sidePanel` — renders the Trail UI next to the user's content.
- `storage` — persists trees + settings to `chrome.storage.local`.
- `tabs` — correlates navigation events with the active tab.
- `webNavigation` — detects page transitions to build the graph.
- `favicon` — renders each node's favicon.
- `alarms` — drives the 60-second sync pull while signed in.
- `identity` — launches Supabase OAuth via `chrome.identity.launchWebAuthFlow`.
  Only invoked when the user clicks "Sign in" in Settings → Account.
- `host_permissions` for `gettrail.net` — content script bridge to the
  marketing + account surfaces (ping + open-panel).

No broad `<all_urls>` permission. No content script on arbitrary pages.

## 5. Offline mode

- [ ] Sign in, load trees, verify sync indicator reaches `saved`
- [ ] Disable network (chrome://net-internals)
- [ ] Mutate a node: sync status goes to `offline`, no crash
- [ ] Reload sidepanel: last tree renders from `chrome.storage.local`
- [ ] Re-enable network: pending ops drain, indicator clears

## 6. Conflict resolution

- [ ] Sign in on two Chrome profiles with the same Google account
- [ ] Edit the same tree on each, both signed in, ~10 s apart
- [ ] Second profile to mutate sees the `SyncConflictBanner` at top
- [ ] "Keep mine" clears the banner and next push wins
- [ ] "Use server" reloads and picks up the other profile's state

## 7. Onboarding (cold profile)

- [ ] Fresh Chrome profile, install extension unpacked or from CWS
- [ ] Open sidepanel: wizard appears
- [ ] Step through: Welcome → How → Permissions → Demo/Fresh → Shortcuts
- [ ] "Load demo" imports the Japan trip (33 nodes)
- [ ] Close wizard with "Done": no re-open on next sidepanel load
- [ ] Settings → About → "Replay walkthrough" resets and reloads

## 8. Settings pages

- [ ] **Account** — Sign in with Google opens popup, signs in, shows
      avatar + display name + email; Sign out works
- [ ] **Data** — Export a tree (downloads JSON), Import re-creates the
      tree, Clear local wipes storage, Delete account soft-deletes
- [ ] **Appearance** — Light / Dark / System theme picker applies
      correctly (watch `[data-theme]` on `<html>`)
- [ ] **Behavior** — `adaptivePerformance` persists
- [ ] **Shortcuts** — cheat-sheet renders; key labels match useShortcuts
- [ ] **Privacy** — consent toggles persist; disable ends session
- [ ] **About** — version string matches manifest; feedback buttons open

## 9. Theme

- [ ] Light mode: no FOUC on sidepanel cold open
- [ ] Dark mode: no FOUC; `data-theme="dark"` appears before first paint
- [ ] System mode: follows OS; toggling OS mid-session updates UI
- [ ] Settings page: honors the same theme (early-apply script loaded)

## 10. Store listing

- [ ] 5 screenshots 1280×800 (or 640×400) captured on the demo tree
- [ ] Promo tile 440×280 saved under `store-assets/` (gitignored)
- [ ] Description under 10,000 chars; keywords included
- [ ] Privacy policy URL `https://gettrail.net/privacy` resolves
- [ ] Terms URL `https://gettrail.net/terms` resolves
- [ ] Category: "Productivity"

## 11. Release

- [ ] `git tag chrome-v<version> && git push --tags`
- [ ] `release-extension.yml` completes green
- [ ] GitHub Release has the `.zip` artifact attached
- [ ] Draft upload visible in CWS Developer Dashboard
- [ ] Click "Publish" manually after reviewing in the dashboard preview
