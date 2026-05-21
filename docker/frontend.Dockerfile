# ===== Build Stage =====
FROM node:18-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/frontend/package.json packages/frontend/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types packages/shared-types
COPY packages/frontend packages/frontend
COPY tsconfig.base.json ./

RUN pnpm --filter @aigc/shared-types build
RUN pnpm --filter @aigc/frontend build

# ===== Production Stage =====
FROM nginx:alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
