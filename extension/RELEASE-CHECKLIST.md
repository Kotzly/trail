# Release Checklist — Trail v1.0.0

Step-by-step verification for Chrome Web Store submission.
Run through each section before every release. Every item is a checkbox.

---

## 1. Build Verification

- [ ] `pnpm build` completes without errors
- [ ] `pnpm test` passes (architecture boundaries, rpc schema, smoke stubs, UI stubs)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Build output in `.output/chrome-mv3/` contains expected entrypoints:
  - `sidepanel/index.html`
  - `newtab.html`
  - `background.js`
  - `account/index.html`
  - `fullview/index.html`
  - `offscreen-graph/index.html`
  - `spotlight-graph/index.html`
  - `content-scripts/content.js`
- [ ] `manifest.json` version matches release target (`1.0.0`)
  - Verify: `grep '"version"' .output/chrome-mv3/manifest.json`

## 2. Permissions Check

- [ ] `manifest.json` `permissions` contains only these (no extras):
  - `sidePanel`, `storage`, `tabs`, `webNavigation`, `favicon`, `alarms`, `activeTab`, `bookmarks`, `offscreen`
  - No `scripting`, no `search`, no `<all_urls>` permission
- [ ] `host_permissions` are exactly: `https://gettrail.net/*`, `https://app.gettrail.net/*`
  - Verify: `jq '.host_permissions' .output/chrome-mv3/manifest.json`
- [ ] No `http://` or `localhost` origins in production manifest
  - Verify: `grep -E 'localhost|127\.0\.0\.1|http://' .output/chrome-mv3/manifest.json` returns nothing
- [ ] CSP includes `unsafe-eval` only for pixi.js (documented rationale in `wxt.config.ts` or `.meta/planning`)
- [ ] Architecture boundary test confirms manifest checks:
  - Run: `cd extension && node --import tsx tests/architecture-boundaries.test.ts`

## 3. Offline Mode

- [ ] Install extension, authenticate, load trees
- [ ] Disconnect network (chrome://net-internals or airplane mode)
- [ ] Open sidepanel: sync indicator shows offline status
- [ ] Navigate existing trees: graph renders from cache
- [ ] Attempt sync: toast shows offline error, no crash
- [ ] Reconnect network: sync resumes, indicator clears

## 4. Empty States

- [ ] New tab page with no bookmarks: shows fallback CTA with explanation
- [ ] Sidepanel with no trees: shows empty state, create tree prompt
- [ ] Search with no results: shows "no results" message
- [ ] Tree dropdown with 0 trees: shows create prompt

## 5. Corrupted Cache Recovery

- [ ] Open DevTools > Application > Local Storage
- [ ] Corrupt a known key (e.g., set layout cache to invalid JSON `{broken`)
- [ ] Reload sidepanel: toast appears explaining auto-reset, panel loads normally
- [ ] Corrupt `editorMode` storage: reload, verify default mode restored with toast
- [ ] Verify no data loss beyond the corrupted cache entry

## 6. Service Worker Restart

- [ ] Open sidepanel with authenticated session
- [ ] Go to chrome://extensions, disable then re-enable extension
- [ ] Open sidepanel: bootstrap recovery engages, session restored
- [ ] Verify `editorMode` persists across worker restart
- [ ] Verify sync resumes after worker restart

## 7. Cold Profile Testing (First Install)

Purpose: Verify the first-run experience from a completely clean state.
Start from a fresh Chrome profile with no Trail data.

- [ ] Create new Chrome profile (chrome://settings > People > Add)
- [ ] Install extension from CWS or load unpacked from `.output/chrome-mv3/`
- [ ] First open: onboarding hints appear (search, tree switch, tag, spotlight)
- [ ] Guest mode works: local tree created, no auth required
- [ ] Auth flow: sign in via email/password or Google OAuth, trees sync from server
- [ ] First tree creation: graph renders, nodes appear
- [ ] All entrypoints work:
  - Sidepanel opens from toolbar icon
  - New tab shows Trail dashboard
  - Spotlight activates via Cmd+Shift+K (Mac) or Ctrl+Shift+K
  - Account page loads at extension account entrypoint

## 8. Dirty Returning User Testing (Existing Data)

Purpose: Verify upgrade/reload behavior with pre-existing data.
Use a profile with existing Trail data (multiple trees, tags, archives).

- [ ] Open extension with existing data: trees load, graph renders cached state
- [ ] Archived/stub trees show explanation in dropdown
- [ ] Tags and filters preserved across sessions
- [ ] Session expiry handled: banner appears, re-auth works
- [ ] Export a tree, verify JSON contains full structure
- [ ] Import a previously exported tree, verify fidelity
- [ ] Settings page shows existing preferences
- [ ] Privacy section shows correct local vs cloud data explanation

## 9. Pre-Submission Final

- [ ] Version number updated in `wxt.config.ts` manifest section
- [ ] Version number matches in `package.json`
- [ ] Screenshots updated (if UI changed since last release)
- [ ] Extension description current in CWS listing
- [ ] Privacy policy URL valid and current (`https://gettrail.net/privacy`)
- [ ] All automated tests pass: `cd extension && pnpm test`
- [ ] Manual smoke tests from sections 3-8 completed on at least one Cold Profile
- [ ] Manual smoke tests from sections 3-8 completed on at least one Dirty returning profile
