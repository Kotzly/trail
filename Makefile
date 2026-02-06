.PHONY: dev db-up db-down db-migrate dev-marketing dev-account dev-api lint typecheck test extension e2e

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

dev-api:
	pnpm --filter @trail/api dev

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

extension:
	cd extension && npm run build

e2e: db-up
	@set -a; \
	if [ -f .env.e2e ]; then . ./.env.e2e; fi; \
	set +a; \
	pnpm --dir extension run build:local; \
	pnpm db:migrate; \
	pnpm dev
