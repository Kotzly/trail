Follow `CLAUDE.md` for agent workflow and review expectations. This file is for repo-specific commands and workflows only.

## Setup
- `make setup` or `pnpm install`
- Copy env files before first run:
  - `cp apps/marketing/.env.example apps/marketing/.env.local`
  - `cp extension/.env.example extension/.env.local`

## Daily development
- `make dev` or `pnpm dev` — marketing + extension
- `pnpm dev:web` — web workspaces only
- `pnpm dev:marketing` — marketing app only on `http://localhost:3000`
- `pnpm dev:extension` — extension only
- `pnpm --dir sanity dev` — Sanity Studio

## Quality checks
- `make check` — lint + typecheck + test
- `make lint`, `make typecheck`, `make test`, `make build`, `make clean`
- `pnpm format` — recursive workspace formatting

## Database
- Hosted Supabase only; do not expect a local Supabase stack
- `make migrate` or `pnpm db:migrate` — push linked migrations
- `make types` or `pnpm db:types` — regenerate `packages/db/src/generated/database.types.ts`
- pgTAP tests under `supabase/tests/` are CI-only

## Extension workflows
- Load Chrome dev build from `extension/.output/chrome-mv3-dev`
- After a fresh install, run `pnpm --dir extension exec wxt prepare` before standalone extension typechecks if WXT virtual types are missing
- `pnpm --dir extension check` — extension CI parity (`typecheck`, `lint`, `format:check`)
- `pnpm --dir extension test` — extension node tests
- `pnpm --dir extension e2e` — Playwright e2e after a production build
- `pnpm --dir extension e2e:ui` — Playwright UI runner after a production build
- `pnpm --dir extension bench:sidepanel-cold-load` — cold-load sidepanel benchmark
- `pnpm --dir extension dev:firefox` — Firefox MV3 dev mode
- `pnpm --dir extension build:firefox` — Firefox MV3 production build to `dist/firefox-mv3/`
- `pnpm --dir extension zip` / `pnpm --dir extension zip:firefox` — packaged extension archives
- `git tag chrome-v<semver> && git push --tags` — trigger extension release workflow

## Legacy / niche workflows
- `pnpm test:e2e` or `pnpm test:e2e:open` — legacy Cypress flow
- `pnpm --dir sanity build`, `pnpm --dir sanity deploy`, `pnpm --dir sanity deploy-graphql` — Sanity release tasks
