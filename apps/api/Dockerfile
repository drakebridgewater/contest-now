# Build from the repository root:  docker build -f apps/api/Dockerfile .
#
# The workspace layout is preserved in the runtime image so Node resolves
# apps/api/node_modules and then the hoisted /app/node_modules, exactly as npm
# installed them.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# No --include-workspace-root: the image never needs the repo's lint/test tooling.
RUN npm ci --workspace apps/api --workspace packages/shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# tsup bundles @contest/shared into dist, so the shared package is build-time only.
RUN npm run build -w apps/api

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api \
  && npm cache clean --force

FROM node:22-alpine
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    PORT=3001 \
    HOST=0.0.0.0 \
    UPLOADS_DIR=/data/uploads \
    MIGRATIONS_DIR=/app/apps/api/drizzle \
    LOG_LEVEL=info
WORKDIR /app/apps/api
# su-exec drops privileges in the entrypoint; see docker-entrypoint.sh for why
# the container has to start as root at all.
RUN apk add --no-cache curl su-exec \
  && addgroup -S app && adduser -S app -G app \
  && mkdir -p /data/uploads && chown -R app:app /data
# One copy of the whole install tree: hoisted /app/node_modules plus any
# per-workspace node_modules npm chose not to hoist.
COPY --from=deps /app /app
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY apps/api/drizzle /app/apps/api/drizzle
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Set here too, so the image does not depend on the checkout preserving the bit.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
# Deliberately not `USER app`: the entrypoint needs root to chown the uploads
# mount, and drops to app with su-exec before the server ever starts.
EXPOSE 3001
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
