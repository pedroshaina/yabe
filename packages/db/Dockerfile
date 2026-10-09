FROM node:24-slim
# Prisma's schema engine links against OpenSSL; without it Prisma warns and guesses a version.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json packages/db/
# Keeps dev dependencies: the Prisma CLI that runs the migrations is one.
RUN pnpm install --frozen-lockfile --filter @yabe/db

COPY packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma

WORKDIR /app/packages/db
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
