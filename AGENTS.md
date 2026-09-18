# AGENTS.md

Smasara workspace: Go (Fiber) backend + SvelteKit frontend + PostgreSQL, orchestrated by docker-compose. In-code comments and error messages are largely in Indonesian — match that style.

## Layout

- `backend/` — Go 1.26, Fiber v2, pgx v5, sqlc. Entrypoint: `backend/main.go` (all routes registered inline here).
  - `internal/database/` — sqlc-generated code (`db.go`, `models.go`, `queries.sql.go`) — **do not hand-edit**; edit `queries.sql` / `schema.sql` and regenerate.
  - `internal/database/migrations/` — numbered `.sql` files (`0001_init.sql` …). `database.RunMigrations` runs them automatically on server start (idempotent). New migration = add next-numbered file, nothing else.
  - `internal/handlers/`, `internal/middleware/` (JWT `Protected()`, workspace RBAC `RequireWorkspaceAccess`).
- `frontend/` — SvelteKit 2 + Svelte 5 + Tailwind 4 + TypeScript.
- `docs/` — **local-only, not tracked in git** (intentional; do not re-add). Holds only a pointer README. The actual planning docs (PRD, decision log, roadmap, tasks, architecture notes) live in the Obsidian vault at `C:\Users\LOQ 54\Documents\Smasara Vault`.

## Commands

Full stack: `docker compose up --build` (db :5432, backend :8080, frontend :5173; frontend has hot-reload via volume mount).

Backend (in `backend/`):
- Run locally: `go run .` — requires Postgres reachable via `DATABASE_URL` in `.env` (loaded by godotenv).
- After editing `queries.sql`/`schema.sql`: `sqlc generate`.
- There is **no `go test` suite**. Verification = E2E bash scripts `test_t101.sh` … `test_t103.sh`, which curl `http://localhost:8080`. Server must be running first; scripts need bash + curl + python3 (use Git Bash/WSL on Windows).

Frontend (in `frontend/`):
- `npm run dev` | `npm run check` (svelte-check typecheck) | `npm run lint` (prettier + eslint) | `npm run format`.
- No frontend tests exist.

Order before considering work done: backend compiles + relevant `test_t*.sh` passes → frontend `npm run check && npm run lint`.

## Gotchas

- Route order matters: `/documents/trash` is registered **before** `/documents/:document_id` or Fiber treats `trash` as an ID. Keep this ordering when adding static subroutes.
- Auth/workspace routes are rate-limited (5 req/min per IP via `authLimiter`) — E2E scripts and manual testing can hit this; expect 429s.
- Credential mismatch trap: docker-compose db user is `postgres`, but local `backend/.env` uses `postgre` in `DATABASE_URL`. Local backend + docker db will fail auth until aligned.
- `docker-compose.yml` contains a hardcoded DB password — known, matches repo's current dev-only posture.
- Soft-delete is the default document delete; hard delete is a separate route (`DELETE .../documents/:document_id/hard`). Soft delete also unpublishes via DB trigger (migration 0004).
