# One image per app: docker build --build-arg APP=indexer . (or APP=api)
FROM node:24-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Manifests first, so dependency installs are cached across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .pnpmfile.cjs ./
COPY apps/api/package.json apps/api/
COPY apps/indexer/package.json apps/indexer/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

COPY . .
ARG APP
# --legacy: pnpm 10 only deploys injected workspaces by default, and injecting would
# break source edits to @yabe/db during development.
RUN test -n "$APP" \
  && pnpm --filter "@yabe/${APP}..." build \
  && pnpm --filter "@yabe/${APP}" deploy --legacy --prod /out

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
CMD ["node", "dist/main.js"]
