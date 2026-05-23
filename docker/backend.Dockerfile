# ===== Build Stage =====
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/backend/package.json packages/backend/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types packages/shared-types
COPY packages/backend packages/backend
COPY tsconfig.base.json ./

RUN pnpm --filter @aigc/shared-types build
RUN pnpm --filter @aigc/backend build

# ===== Production Stage =====
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
