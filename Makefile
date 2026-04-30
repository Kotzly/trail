.PHONY: help setup dev test lint typecheck build clean migrate types check

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Trail — make targets:\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

setup: ## Install all workspace deps (pnpm install)
	pnpm install

dev: ## Run marketing + account + extension in parallel
	pnpm dev

test: ## Run all workspace tests
	pnpm test

lint: ## Lint all workspaces
	pnpm lint

typecheck: ## Typecheck all workspaces
	pnpm typecheck

build: ## Build all workspaces (apps + extension)
	pnpm build

clean: ## Remove node_modules and build artifacts
	pnpm clean

migrate: ## Push migrations to hosted Supabase (linked project)
	npx supabase db push --linked

types: ## Regenerate Supabase Database types
	pnpm db:types

check: ## Lint + typecheck + test (CI parity, fast feedback)
	pnpm lint && pnpm typecheck && pnpm test
