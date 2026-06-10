# AGENTS.md

## Repository overview

AIGC video-generation platform for TikTok Shop. pnpm monorepo with Turborepo, three packages:

| Package      | Path                      | Name                   | Runtime                                         |
| ------------ | ------------------------- | ---------------------- | ----------------------------------------------- |
| Backend      | `packages/backend`      | `@aigc/backend`      | NestJS (CommonJS, node moduleResolution)        |
| Frontend     | `packages/frontend`     | `@aigc/frontend`     | React 18 + Vite (ESM, bundler moduleResolution) |
| Shared types | `packages/shared-types` | `@aigc/shared-types` | Type-only (source-level resolution)             |

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
- **Local uploads** are served statically at `/uploads` and physically saved to `UPLOAD_DIR/materials`.
- **WebSocket events** must use the constants and payload types defined in `packages/shared-types/src/websocket.ts`.
- **TypeORM `synchronize: true` in dev** (gated on `NODE_ENV !== 'production'`). Schema auto-syncs from entities — no migrations needed locally.
- **Production Schema Initialization & Migrations (CRITICAL)**: Production must use explicit TypeORM migrations (`migration:run`). Do NOT use `init.sql` to create business tables. `docker/postgres/init.sql` is strictly for installing database extensions (e.g., `vector`, `pg_trgm`) that require superuser privileges. All table creation, including the initial schema, must be managed and tracked by TypeORM migrations. If production is a fresh database, ensure a full initialization migration exists.
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

## Continuous Mobile Adaptation

 Agents MUST ensure all new features and UI changes are fully adapted for mobile devices.

- Follow the **Responsive (Strategy B)** approach: one codebase for all screens.
- Maintain the **Grid Overlay Menu** for mobile navigation.
- Apply **Table-to-Card transformation** for complex data lists on small screens to avoid horizontal overflow.
- Use **Infinite Scroll (IntersectionObserver)** for mobile lists instead of traditional pagination where appropriate.
- Always verify UI changes at the `768px` (Ant Design `md`) breakpoint using the `useMediaQuery` hook.

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
- `openapi.json` - Swagger API specifications
- `database_er.mermaid` - Database ER diagram
- `火山方舟_API参考/AGENTS.md` - Specialized guide for AI agents to efficiently use the Volcano Ark API local documentation.

## ⚠️ Documentation Updates (CRITICAL)

**Agents must keep documentation in sync.**
Whenever you make a difference to the project state, complete a feature, fix a bug, or achieve a goal:

1. You MUST evaluate whether `AGENTS/PROJECT_PROGRESS.md` or any other documentation (like `README.md`, `API_SPEC.md`, `AGENTS.md`) needs an update.
2. If so, proactively modify those files to reflect the real current state of the codebase.
3. Treat documentation updates as an inseparable part of delivering code.
4. **README.md Competition Reporting Requirements:** You MUST ensure `README.md` includes and actively maintains the following information whenever project state changes:

### Aents must maintain those information in README.md

**key notes**

- If there is information you don't know, just leave a space for the user to fill in (use keyword `TODO:` to prompt; if `TODO` is not present, it means the user has already entered the information )
- use chinese to write README.md , no emojis

**Project Outcomes Content Standards and Requirements (must include at least the following):**

- Project Name
- Competition Topic
- Team Members and Roles
- One-sentence Core Business Value
- Online Demo Link / App Install Package / Agent Skill Package
- Demo Video Link
- Source Code Repository Link
- README / Running Instructions

**Principles:**

- **Accessible**: Judges should see the project's value via the shortest path; external links should avoid login barriers, permission requests, or paywalls.
- **Understandable**: Beyond code, include the project story, business value, architecture description, and key design explanations.
- **Verifiable**: Repositories, READMEs, deployment docs, and experience paths must be provided to support review and replication.
- **Demonstrate Full-Stack Capability**: In addition to model effects, showcase frontend interactions, backend services, data flows, deployment, and integration capabilities.

**[Mandatory] Competition Submission Fields:**

- **Basic Info**: Efficiency improvement format, Project Name / Topic, Team Name and Member List, Role Distribution (specify module owners).
- **Feature Description**: Core Feature List (3-6 recommended), End-to-End User Flow (5-8 sentences + demo video).
- **Delivery Materials**: Online Demo Link, Demo Video Link (3-8 minutes), Source Code Repository Link, README / Running Instructions (must include intro, env dependencies, start steps, directory structure, config details).
- **Technical Description**: System Architecture Diagram, Core Tech Stack, LLM / AI Capabilities Usage (models used, APIs, Prompt strategies), Key Engineering Challenges & Solutions (at least 2-3), Deployment and Access Instructions.
- **Result Description**: Project Completion Level (MVP/Demo/Production-ready), Project Highlights / Innovations (up to 3).

**[Optional] Recommended Supplemental Fields:**

- Document Materials/Project Walkthrough, Product Screenshots/UI Gallery, Database Design/ER Diagrams, API Docs/Lists, Performance Metrics/Stress Test Results, Prompt Strategies/Agent Flowcharts, Evaluation Plans and Sample Results, Commercialization/Scenario Landing Ideas, User Feedback/Beta Testing Logs, Development Milestones/Version Iteration Records.
