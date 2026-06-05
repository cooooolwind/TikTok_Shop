# ===== Build Stage =====
FROM node:22-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/video-renderer/package.json packages/video-renderer/
COPY packages/backend/package.json packages/backend/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types packages/shared-types
COPY packages/video-renderer packages/video-renderer
COPY packages/backend packages/backend
COPY tsconfig.base.json ./

RUN pnpm --filter @aigc/shared-types build
RUN pnpm --filter @aigc/video-renderer build
RUN pnpm --filter @aigc/backend build

# Use pnpm deploy to isolate backend and its production dependencies
RUN pnpm deploy --filter @aigc/backend --prod /app/deploy

# ===== Production Stage =====
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg chromium ca-certificates fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*
ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
RUN ffmpeg -version
COPY --from=builder /app/deploy ./
# In case pnpm deploy misses dist due to missing 'files' in package.json
COPY --from=builder /app/packages/backend/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
