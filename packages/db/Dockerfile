FROM node:24-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter @yabe/db

COPY packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma

WORKDIR /app/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]
