# Trail

Trail is a browser extension that visualizes browsing history as an interactive navigation tree, plus a marketing site, account app, and supporting packages — all in one monorepo.

## Tech stack

- **Runtime:** Next.js 16, React 19, TypeScript
- **Extension:** WXT (Chrome/Brave), Pixi.js
- **Backend:** Better Auth, tRPC, Prisma (PostgreSQL)
- **UI:** Tailwind CSS 4, Radix UI, Motion
- **CMS:** Sanity Studio
- **Video:** Remotion
- **Testing:** Vitest, Cypress
- **Package manager:** pnpm 10

## Monorepo layout

```
apps/
  marketing/        - gettrail.net (landing, legal, support)
  account/          - app.gettrail.net (dashboard, auth, API runtime)
  video/            - Remotion video generation
  support-bot/      - support chat bot
packages/
  ui/               - shared UI components + Tailwind preset
  content/          - copy strings (marketing, account)
  db/               - Prisma schema + client
  trpc/             - shared tRPC router
  config/           - shared TypeScript configs
extension/          - browser extension (separate workspace)
sanity/studio-trail/- Sanity CMS studio
docs/               - project documentation
```

## Quickstart (local)

1. `pnpm install`
2. `docker compose up -d postgres`
3. `cp apps/account/.env.example apps/account/.env.local`
4. `cp apps/marketing/.env.example apps/marketing/.env.local`
5. `cp packages/db/.env.example packages/db/.env`
6. `pnpm db:generate`
7. `pnpm db:migrate`
8. `pnpm dev`

Ports:
- Marketing: `http://localhost:3000`
- Account: `http://localhost:3001`

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run web apps + extension in parallel |
| `pnpm dev:web` | Run web apps only (marketing + account) |
| `pnpm dev:extension` | Run extension only |
| `pnpm dev:marketing` | Marketing app only |
| `pnpm dev:account` | Account app only |
| `pnpm build` | Generate Prisma client + build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests across all packages |
| `pnpm test:e2e` | Run Cypress end-to-end tests |
| `pnpm test:e2e:open` | Open Cypress test runner |
| `pnpm typecheck` | Type-check all packages |
| `pnpm format` | Format all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations (dev) |
| `pnpm db:migrate:deploy` | Run Prisma migrations (production) |
| `pnpm db:studio` | Open Prisma Studio |

## Runtime model

- Public API/Auth domain: `https://app.gettrail.net`
- Better Auth JWKS: `https://app.gettrail.net/api/auth/jwks`
- API routes: `https://app.gettrail.net/api/v1/*`
- tRPC route: `https://app.gettrail.net/api/trpc/*`

## Documentation

See [`docs/README.md`](docs/README.md) for the full documentation index.
