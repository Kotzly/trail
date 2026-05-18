# Contributing

## Prerequisites

- Node.js 20+
- pnpm 10+
- Chrome / Chromium

## Setup

```bash
# From the monorepo root
pnpm install
cd extension

# One of:
pnpm dev              # default backend preset
pnpm dev:local        # points extension at local Supabase / dev services
pnpm dev:gettrail     # points extension at gettrail.net
```

WXT opens a fresh Chromium profile with the extension loaded.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Watch mode dev build + auto-reload Chromium |
| `pnpm dev:firefox` | Watch mode dev build + auto-reload Firefox |
| `pnpm build` | Production build to `.output/chrome-mv3` |
| `pnpm build:firefox` | Production build to `.output/firefox-mv2` |
| `pnpm zip` | Package the Chrome build for Web Store upload |
| `pnpm zip:firefox` | Package the Firefox build for AMO upload |
| `pnpm typecheck` | `tsc --noEmit` across the project |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` | Run the test suite (tsx-based) |
| `pnpm check` | typecheck + lint + format:check (CI mirror) |

## Testing

Tests live in `tests/` and are run directly via `node --import tsx`. They are
structural/contract checks, not browser-driven. Full E2E (Playwright) is
scheduled for Wave 10.

To add a test: create `tests/<name>.test.ts` and append it to the `test`
script in `package.json`.

## Commit style

We use **Conventional Commits**-ish:

- `feat(scope): short summary`
- `fix(scope): …`
- `refactor(scope): …`
- `docs(scope): …`
- `chore(scope): …`

Examples:
- `feat(sidepanel): wire ⌘K command palette via cmdk`
- `fix(nav): honor tab.pinned when creating new node`

Scopes in common use: `sidepanel`, `settings`, `bg`, `nav`, `graph`,
`transport`, `storage`, `auth`, `sync`, `ui`, `ci`, `docs`.

## Pre-commit hook

`husky` + `lint-staged` run automatically on commit:

- ESLint `--fix` on changed `.ts` / `.tsx`
- Prettier `--write` on changed files

To skip in an emergency: `git commit --no-verify` (don't).

## Pull requests

- One feature/fix per PR.
- CI must be green (`ci-extension.yml`: lint + format:check + typecheck + test + build).
- Keep diffs small. If a PR touches > ~400 lines, think hard about splitting.
- Update `tasks/todo.md` if the PR ticks items off.
- Update `tasks/lessons.md` if the review surfaced a new rule for the project.

## Architectural rules

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture. The
ship-blocking rules enforced by tests:

- **No UI → background imports** (other than types). Enforced by
  `tests/architecture-boundaries.test.ts`.
- **No template literals in `className`.** Enforced by ESLint.
- **No raw `chrome.storage` access in business logic.** Go through storage
  items or owning services.
- **No ELK.js / PixiJS / dynamic code generation.** Enforced by the CSP
  stance and the layout-precompute regression test.

## Release

Releases are automated:

1. Merge to `main`.
2. Bump `version` in `wxt.config.ts` and `package.json` (keep them in sync).
3. Update `CHANGELOG.md`.
4. `git tag chrome-v1.2.3 && git push --tags`
5. `release-extension.yml` builds the .zip, uploads a **draft** to the
   Chrome Web Store, and creates a GitHub Release.
6. Manually click Publish in the Web Store dashboard.
