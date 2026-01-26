# Repository Guidelines

## Project Structure & Module Organization
- `apps/marketing/` — Next.js marketing site (gettrail.net).
- `apps/account/` — Next.js account app (my.gettrail.net) with Auth0 + tRPC.
- `apps/api/` — Next.js API app (api.gettrail.net) exposing tRPC.
- `packages/ui/` — shared UI components, Tailwind preset, tokens.
- `packages/content/` — copy strings (English only).
- `packages/db/` — Prisma schema + client.
- `packages/trpc/` — shared tRPC router/types.
- `extension/` — Chrome/Brave extension (unchanged).

## Build, Test, and Development Commands
- `pnpm dev` — run all apps.
- `pnpm dev:marketing` / `pnpm dev:account` / `pnpm dev:api` — run individual apps.
- `pnpm db:migrate` — run Prisma migrations.
- `make dev` — alias for `pnpm dev`.
- `docker compose up -d postgres` — start Postgres.

## Coding Style & Naming Conventions
- TypeScript/React: 2-space indentation.
- Keep components in `PascalCase` and hooks as `useX`.
- Match file-local quote style (frontend uses double quotes; extension uses single quotes).
- Do not edit generated files.

## Testing Guidelines
- Frontend: Vitest + Testing Library (to be added), Cypress for e2e.
- Extension tests live in `extension/tests/` and run with `npm test`.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and usually capitalized (e.g., “Refactor …”, “Add …”); no scope prefixes in history.
- PRs should include a concise summary, testing notes, and screenshots for UI changes (frontend or extension).

## Deployment
- Deployment is handled by Vercel.
- The marketing, account and API apps are deployed to Vercel.
- They can be found at the following URLs:
  - Marketing: https://gettrail.net
  - Account: https://my.gettrail.net
  - API: https://api.gettrail.net
- The extension is not yet deployed.
- The auth is handled by Auth0.
- The database is handled by Supabase.