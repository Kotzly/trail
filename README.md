# Trail

Trail visualises browsing sessions as an interactive navigation tree. The repo holds the marketing site, the browser extension (which owns the account UI), and supporting packages.

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
  marketing/        gettrail.net — landing, legal, support, public shared-trail
                    viewer at /s/<code>, password-reset page at /auth/reset-password
extension/          browser extension (separate workspace, WXT-based) — owns
                    sign-in, account UI, trail sync, sharing flow
packages/
  config/           shared TS configs
  content/          static copy strings
  db/               generated Supabase Database types + thin client
sanity/studio-trail/Sanity CMS studio
supabase/           migrations, seed (CI-only), pgTAP tests
```

> Note: the legacy `apps/account` app (formerly served at `app.gettrail.net`)
> was retired. The extension authenticates directly via Supabase, marketing
> hosts the one remaining web auth surface (`/auth/reset-password`), and
> `app.gettrail.net` will 301-redirect to `gettrail.net` until DNS retires
> the subdomain.

## Quickstart

Prereqs: Node 22+, pnpm 10, Supabase project credentials (ask the lead if you do not yet have them).

```sh
git clone <repo> && cd trail
cp apps/marketing/.env.example apps/marketing/.env.local
cp extension/.env.example extension/.env.local
# Fill in Supabase URL/keys + secrets in each .env.local
make setup
make dev
```

Ports:
- Marketing: `http://localhost:3000`
- Extension: loaded as unpacked from `extension/.output/chrome-mv3-dev` (WXT auto-reloads)

## Make targets

| Target | What it does |
|---|---|
| `make setup` | `pnpm install` |
| `make dev` | run marketing + extension in parallel |
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
| `pnpm dev:marketing` | Single app |
| `pnpm build` / `lint` / `test` / `typecheck` / `format` | Recursive across workspaces |
| `pnpm clean` | Remove all node_modules and build outputs |
| `pnpm db:migrate` | Push Supabase migrations (`supabase db push`) |
| `pnpm db:types` | Regenerate `packages/db/src/generated/database.types.ts` |

## Runtime model

- Public web origin: `https://gettrail.net` (marketing + share viewer + reset-password)
- Auth: Supabase (Google OAuth + email/password + email OTP). The extension uses `chrome.identity.launchWebAuthFlow` against the Supabase authorize URL and `chromiumapp.org` as the redirect target — no web origin is involved for OAuth.
- Password reset: extension calls `resetPasswordForEmail(redirectTo="https://gettrail.net/auth/reset-password")`; the link lands on marketing's reset-password page.
- Trail sync: extension writes directly to Supabase via RLS-gated `trails` upserts; no REST API.
- Shared trails: rows in `shared_trail_links`, served read-only at `https://gettrail.net/s/<code>` via the `get_shared_trail` RPC; importers clone via `import_shared_trail`.
- Supabase project: `tevskvkyhenzqxkcgbbm` (hosted; no local Supabase stack)

## Database & migrations

Migrations live in `supabase/migrations/`. They are applied to the hosted project with:

```sh
make migrate            # or: npx supabase db push --linked
```

pgTAP tests in `supabase/tests/` run only in CI (`.github/workflows/ci-supabase.yml`) against an ephemeral Postgres. Local pgTAP runs are not supported.

## Extension specifics

See [`extension/README.md`](extension/README.md) for MV3 service-worker model, sync engine, sidepanel architecture, and dev/release flows.

## License

Licensed under the [Apache License 2.0](LICENSE).
