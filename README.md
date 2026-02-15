# Trail

Trail is a monorepo for the marketing site, account app (web + auth + API runtime), and browser extension.

## Monorepo layout
- `apps/marketing` - `gettrail.net`
- `apps/account` - `app.gettrail.net` (web, Better Auth, `/api/v1`, `/api/trpc`)
- `packages/ui` - shared UI + tokens
- `packages/content` - copy strings
- `packages/db` - Prisma schema + client
- `packages/trpc` - shared tRPC router
- `extension/` - browser extension

## Quickstart (local)
1. `pnpm install`
2. `docker compose up -d postgres`
3. `cp apps/account/.env.example apps/account/.env.local`
4. `cp apps/marketing/.env.example apps/marketing/.env.local`
5. `pnpm db:migrate`
6. `pnpm dev`

Ports:
- Marketing: `http://localhost:3000`
- Account: `http://localhost:3001`

## Scripts
- `pnpm dev` - run web apps + extension local dev
- `pnpm dev:marketing` - marketing only
- `pnpm dev:account` - account only
- `pnpm db:migrate` - run Prisma migrations

## Runtime model
- Public API/Auth domain: `https://app.gettrail.net`
- Better Auth JWKS: `https://app.gettrail.net/api/auth/jwks`
- API routes: `https://app.gettrail.net/api/v1/*`
- tRPC route: `https://app.gettrail.net/api/trpc/*`
