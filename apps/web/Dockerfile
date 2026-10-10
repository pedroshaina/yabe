# The web frontend: docker build -f apps/web/Dockerfile -t yabe-web .
FROM node:24-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Manifests first, so dependency installs are cached across source changes. The root package
# is included for TypeScript and the type packages `next build` uses.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .pnpmfile.cjs ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter yabe --filter @yabe/web

COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN pnpm --filter @yabe/web build

FROM node:24-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# The standalone server and the node_modules it traced; static assets go beside it.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
