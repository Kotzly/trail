# Trail

Trail is a monorepo that ships the browser extension plus a Next.js-based SaaS frontend and API.

## Monorepo layout
- `apps/marketing` — gettrail.net (landing + FAQ)
- `apps/account` — app.gettrail.net (account app + Better Auth bridge + tRPC)
- `apps/api` — api.gettrail.net (tRPC endpoint)
- `apps/auth` — auth.gettrail.net (Better Auth service)
- `packages/ui` — shared UI + tokens
- `packages/content` — copy strings (English only)
- `packages/db` — Prisma schema + client
- `packages/trpc` — shared tRPC router
- `extension/` — existing browser extension (unchanged)

## Quickstart (local)
1. Install deps: `pnpm install`
2. Start Postgres: `docker compose up -d postgres`
3. Set envs:
   - `cp apps/account/.env.example apps/account/.env.local`
   - `cp apps/api/.env.example apps/api/.env.local`
4. Run migrations: `pnpm db:migrate`
5. Start apps: `pnpm dev`

Ports:
- Marketing: `http://localhost:3000`
- Account: `http://localhost:3001`
- API: `http://localhost:3002`

## Better Auth setup
Create and fill local envs for all apps:
- `cp apps/account/.env.example apps/account/.env.local`
- `cp apps/api/.env.example apps/api/.env.local`
- `cp apps/auth/.env.example apps/auth/.env.local`

Set `BETTER_AUTH_URL` and provider/email variables in `apps/auth/.env.local` for your environment.

## Extension login handoff (planned)
Current flow:
- Extension opens `https://app.gettrail.net/extension`.
- User completes Better Auth login in browser.
- The page issues a one-time code stored in Postgres.
- The extension exchanges the code via `POST /api/extension/exchange`.

Token issuance will be added when the extension API is finalized.

## Scripts
- `pnpm dev` — run all apps
- `pnpm dev:marketing` — marketing only
- `pnpm dev:account` — account only
- `pnpm dev:api` — api only
- `pnpm db:migrate` — run Prisma migrations

## Deployment notes
- `apps/account` proxies its `/api/trpc` to `apps/api` using `TRAIL_API_BASE_URL` and a shared server-only `TRAIL_INTERNAL_API_KEY`.

## Extension (existing)
The extension remains unchanged and runs from `extension/`.
