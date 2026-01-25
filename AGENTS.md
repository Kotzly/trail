# Repository Guidelines

## Project Structure & Module Organization
- `backend/` Go 1.22+ API (Echo) with `cmd/api` entrypoint, `internal/` for domain layers, and `migrations/` for SQL.
- `frontend/` React + Vite web app; API types live in `frontend/src/lib/api/types.ts` (generated).
- `extension/` Chrome/Brave extension; UI in `extension/src/sidepanel/ui`, background logic in `extension/src/background`, shared types in `extension/src/shared`.
- `api/openapi.yml` is the source of truth for API contracts.
- Root tooling: `Makefile`, `docker-compose.yml`, and `dev` convenience script.

## Build, Test, and Development Commands
- `./dev` or `make up` — start Docker Compose stack (migrations run before API start). UI at `http://localhost:5173`.
- `make run-backend` / `make run-frontend` — run API or web app directly; `make run-local` runs both.
- `make generate` — regenerate backend OpenAPI code and frontend types.
- `make test-backend` — Go tests; `make lint-backend` — golangci-lint.
- Frontend: `cd frontend && npm run dev|build|preview`.
- Extension: `cd extension && npm run dev:ui` (UI), `npm run build` (creates `dist/`), `npm test`.

## Coding Style & Naming Conventions
- Go: keep code gofmt’d; run `make lint-backend` before pushing.
- TypeScript/React: 2-space indentation; keep components in `PascalCase` and hooks as `useX`.
- Match file-local quote style (frontend uses double quotes; extension uses single quotes).
- Do not edit generated files (`frontend/src/lib/api/types.ts`, `extension/dist/`).

## Testing Guidelines
- Backend tests use `go test ./...` (via `make test-backend`).
- Extension tests live in `extension/tests/` and run with `npm test`.
- Frontend has no dedicated test runner yet; add tests alongside new critical UI logic when introducing one.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and usually capitalized (e.g., “Refactor …”, “Add …”); no scope prefixes in history.
- PRs should include a concise summary, testing notes, and screenshots for UI changes (frontend or extension).
- Call out schema changes and run `make generate` when `api/openapi.yml` changes.
