# syntax=docker/dockerfile:1
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm -r build
RUN pnpm deploy --filter @yabe/api --prod --legacy /out/api \
 && pnpm deploy --filter @yabe/indexer --prod --legacy /out/indexer

# One-shot schema migration; reuses the build stage because it needs the Prisma CLI.
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:24-slim AS indexer
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/indexer .
USER node
CMD ["node", "dist/main.js"]

FROM node:24-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api .
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
