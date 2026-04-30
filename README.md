# Trail

Trail visualises browsing sessions as an interactive navigation tree. The repo holds the marketing site, the account app, the browser extension, and supporting packages.

## Tech stack

- **Backend:** hosted Supabase — Postgres + Auth + Row-Level Security (no local supabase, no Prisma)
- **Web apps:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, Radix UI, Motion
- **Extension:** WXT (Manifest V3, Chrome/Brave), React 19, Tailwind v4, xyflow
- **Observability:** Sentry, PostHog
- **Testing:** Vitest, Playwright (extension e2e), pgTAP (DB policies, CI-only), Cypress (legacy web e2e)
- **CMS:** Sanity Studio
- **Package manager:** pnpm 10 (workspace)

## Monorepo layout

```
apps/
  marketing/        gettrail.net — landing, legal, support, Telegram feedback bot
  account/          app.gettrail.net — dashboard, auth callbacks, REST API runtime
extension/          browser extension (separate workspace, WXT-based)
packages/
  auth-token/       extension JWT signing/verification (shared with account API)
  config/           shared TS configs
  content/          static copy strings
  db/               generated Supabase Database types + thin client
sanity/studio-trail/Sanity CMS studio
supabase/           migrations, seed (CI-only), pgTAP tests
docs/               project documentation
tasks/              ephemeral planning, lessons, review artefacts
```

## Quickstart

Prereqs: Node 22+, pnpm 10, Supabase project credentials (ask the lead if you do not yet have them).

```sh
git clone <repo> && cd trail
cp apps/account/.env.example apps/account/.env.local
cp apps/marketing/.env.example apps/marketing/.env.local
cp extension/.env.example extension/.env.local
# Fill in Supabase URL/keys + secrets in each .env.local
make setup
make dev
```

Ports:
- Marketing: `http://localhost:3000`
- Account: `http://localhost:4001`
- Extension: loaded as unpacked from `extension/.output/chrome-mv3-dev` (WXT auto-reloads)

## Make targets

| Target | What it does |
|---|---|
| `make setup` | `pnpm install` |
| `make dev` | run marketing + account + extension in parallel |
| `make test` | run all workspace tests |
| `make lint` | lint all workspaces |
| `make typecheck` | typecheck all workspaces |
| `make build` | build all workspaces (apps + extension) |
| `make clean` | remove node_modules + build artefacts |
| `make migrate` | push Supabase migrations to the linked hosted project |
| `make types` | regenerate Supabase Database types |
| `make check` | lint + typecheck + test (CI parity) |
| `make help` | list targets with descriptions |

`make` is a thin wrapper around `pnpm` scripts. Use either; both work.

## pnpm scripts (top-level)

| Script | Description |
|---|---|
| `pnpm dev` | Run web apps + extension in parallel |
| `pnpm dev:web` | Web apps only |
| `pnpm dev:extension` | Extension only |
| `pnpm dev:marketing` / `dev:account` | Single app |
| `pnpm build` / `lint` / `test` / `typecheck` / `format` | Recursive across workspaces |
| `pnpm clean` | Remove all node_modules and build outputs |
| `pnpm db:migrate` | Push Supabase migrations (`supabase db push`) |
| `pnpm db:types` | Regenerate `packages/db/src/generated/database.types.ts` |

## Runtime model

- Public API/Auth domain: `https://app.gettrail.net`
- API routes: `https://app.gettrail.net/api/v1/*`
- Auth: Supabase (Google OAuth + email/password). The extension uses `chrome.identity.launchWebAuthFlow` against the Supabase authorize URL.
- Supabase project: `tevskvkyhenzqxkcgbbm` (hosted; no local Supabase stack)

## Database & migrations

Migrations live in `supabase/migrations/`. They are applied to the hosted project with:

```sh
make migrate            # or: npx supabase db push --linked
```

pgTAP tests in `supabase/tests/` run only in CI (`.github/workflows/ci-supabase.yml`) against an ephemeral Postgres. Local pgTAP runs are not supported.

## Extension specifics

See [`extension/README.md`](extension/README.md) for MV3 service-worker model, sync engine, sidepanel architecture, and dev/release flows.

## Documentation

See [`docs/README.md`](docs/README.md) for the full documentation index.

For the latest project audit and remediation status, see [`tasks/review/`](tasks/review/).
