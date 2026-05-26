# AGENTS.md

## Repository overview

AIGC video-generation platform for TikTok Shop. pnpm monorepo with Turborepo, three packages:

| Package | Path | Name | Runtime |
|---------|------|------|---------|
| Backend | `packages/backend` | `@aigc/backend` | NestJS (CommonJS, node moduleResolution) |
| Frontend | `packages/frontend` | `@aigc/frontend` | React 18 + Vite (ESM, bundler moduleResolution) |
| Shared types | `packages/shared-types` | `@aigc/shared-types` | Type-only (source-level resolution) |

> Prototype-stage. Only `materials` module has real implementation; most other modules are stubs with TODOs. Backend full typecheck fails due to unused variables in stub modules — this is known.

## Commands

```bash
# Install
pnpm install

# Dev (starts DB/Redis containers + frontend + backend)
make dev
# …or manually:
docker compose -f docker-compose.dev.yml up -d postgres redis
pnpm dev          # turbo: parallel frontend (:5173) + backend (:3000)

# Quality checks (CI runs these in order)
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Single-package commands
pnpm --filter @aigc/backend test
pnpm --filter @aigc/backend typecheck
pnpm --filter @aigc/frontend typecheck
pnpm --filter @aigc/frontend test

# Run a single backend test file
pnpm --filter @aigc/backend test -- materials.service.spec.ts

# Format
pnpm format       # prettier across all packages

# Migrations (production)
pnpm --filter @aigc/backend migration:run
pnpm --filter @aigc/backend migration:generate
```

## Architecture gotchas

- **Backend is CommonJS.** The base tsconfig uses `module: ESNext`, but backend overrides to `module: CommonJS` + `moduleResolution: node` (NestJS requirement). Do not use ESM-only imports or top-level await in backend code.
- **Path alias `@/*`** maps to `src/*` in frontend only (tsconfig `paths` + vite `resolve.alias`). Backend does NOT have this alias — use relative imports.
- **shared-types resolves from source** (`"main": "./src/index.ts"`). No build step is needed for dev. Turbo `^build` dependencies still run `tsc` for it, but consumers resolve source directly.
- **API prefix is `/api/v1`.** All backend controllers mount under this global prefix. A `@Controller('materials')` routes to `/api/v1/materials`. Swagger at `/api/docs`.
- **Vite proxies `/api`, `/socket.io`, `/uploads`** to `http://localhost:3000` in dev.
- **TypeORM `synchronize: true` in dev** (gated on `NODE_ENV !== 'production'`). Schema auto-syncs from entities — no migrations needed locally. Production must use migrations.
- **Entities auto-loaded** via `autoLoadEntities: true` in `DatabaseModule`. Register entities in their feature module's `TypeOrmModule.forFeature([...])`.
- **Backend `strictPropertyInitialization: false`** in tsconfig — TypeORM entities don't need definite assignment assertions.

## Shared types contract

`packages/shared-types` is the source of truth for API data structures. When changing API shapes:

1. Update types in `shared-types/src/`
2. Update backend return structures and frontend service/store code to match

API responses use **snake_case** field names per the shared-types contract.

## Testing

- **Backend uses Jest** (`ts-jest`). Test files at `src/**/*.spec.ts`. Uses `@nestjs/testing`.
- **Frontend uses Vitest** (configured inline in `vite.config.ts`). Environment `jsdom`, `globals: true`. Uses `@testing-library/react`.
- **CI runs backend tests with real Postgres (pgvector) + Redis** — locally, tests that hit the DB need `docker compose -f docker-compose.dev.yml up -d` first.

## Style & conventions

- **Prettier:** single quotes, trailing commas, 100 char width, LF line endings
- **ESLint:** `@typescript-eslint/recommended` + prettier. Unused vars are `warn` (prefix `_` to suppress). `no-explicit-any` is `warn`.
- **Commits:** conventional commits enforced via commitlint (`@commitlint/config-conventional`)
- **Lint-staged:** on commit, TS/TSX files get `eslint --fix` + `prettier --write`

## Environment

Copy `.env.example` to `.env` before first run. Key variables:

- `MOCK_MODE=true` — stubs AI calls during dev
- `VOLCANO_API_KEY` — Volcano Engine API key (never commit real keys)
- `JWT_SECRET` — must change for production
- `UPLOAD_DIR=./uploads` — local file storage; served at `/uploads` path

## Infrastructure

- **Postgres 16 + pgvector** — `docker/postgres/init.sql` enables the vector extension on first container start
- **Redis 7** — used by BullMQ task queues and caching
- **Docker Compose files:** `dev` (DB+Redis only), default (full stack build), `prod` (prebuilt images from Alibaba Cloud ACR)
- **CI:** Node 22, uses `turbo --affected` for selective lint/typecheck/test/build
- **CD:** Pushes to Alibaba Cloud ACR, deploys to ECS via `scripts/deploy.sh`

## Reference docs

The `AGENTS/` directory contains detailed design docs:
- `ARCHITECTURE.md` — system architecture
- `API_SPEC.md` — full API contract
- `PROJECT_DOC.md` /  — project requirements, roadmap
- `PROJECT_PROGRESS.md` - current progress tracker

## ⚠️ Documentation Updates (CRITICAL)

**Agents must keep documentation in sync.** 
Whenever you make a difference to the project state, complete a feature, fix a bug, or achieve a goal:
1. You MUST evaluate whether `AGENTS/PROJECT_PROGRESS.md` or any other documentation (like `API_SPEC.md`, `AGENTS.md`) needs an update.
2. If so, proactively modify those files to reflect the real current state of the codebase.
3. Treat documentation updates as an inseparable part of delivering code.
