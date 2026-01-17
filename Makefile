.PHONY: generate run-local test-backend lint-backend up migrate dev

generate:
	cd backend && go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 -config oapi-codegen.yaml ../api/openapi.yml
	cd frontend && npx --yes openapi-typescript ../api/openapi.yml -o src/lib/api/types.ts

run-backend:
	cd backend && go run ./cmd/api

run-frontend:
	cd frontend && npm run dev

run-local:
	$(MAKE) -j2 run-backend run-frontend


test-backend:
	cd backend && go test ./...

lint-backend:
	cd backend && golangci-lint run ./...

up:
	docker compose up --build

dev:
	$(MAKE) up

migrate:
	docker compose run --rm migrate
