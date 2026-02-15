.PHONY: dev db-up db-down db-migrate dev-marketing dev-account lint typecheck test extension e2e

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-migrate:
	pnpm db:migrate

dev:
	pnpm dev

dev-marketing:
	pnpm --filter @trail/marketing dev

dev-account:
	pnpm --filter @trail/account dev

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

extension:
	pnpm --dir extension install --ignore-workspace --frozen-lockfile
	pnpm --dir extension run build

e2e: db-up
	@set -a; \
	if [ -f .env.e2e ]; then . ./.env.e2e; fi; \
	set +a; \
	pnpm --dir extension install --ignore-workspace --frozen-lockfile; \
	pnpm db:migrate; \
	pnpm dev
