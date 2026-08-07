# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ---- Install workspace dependencies (its own layer, cached unless a
# package.json/lockfile changes) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---- Build the frontend. VITE_API_BASE_URL is baked in at build time (Vite
# inlines env vars into the bundle) — "/api" is correct here because the
# runtime stage serves both the API and the frontend from the same origin. ----
FROM deps AS build-web
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @dexplorer/web build

# ---- Runtime: one process (apps/api's Fastify server) serves the REST API
# and the built frontend together, so the whole app runs behind a single
# port. Runs via tsx (same as `pnpm --filter @dexplorer/api start` in dev) —
# this workspace deliberately has no separate compile step for apps/api. ----
FROM deps AS runtime
ENV NODE_ENV=production
COPY . .
COPY --from=build-web /app/apps/web/dist ./apps/web/dist
ENV STATIC_DIR=/app/apps/web/dist

EXPOSE 4000
CMD ["pnpm", "--filter", "@dexplorer/api", "start"]
