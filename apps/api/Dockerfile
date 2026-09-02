# Build from the repository root:  docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --workspace packages/shared --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api --workspace packages/shared --include-workspace-root \
  && npm cache clean --force

FROM node:22-alpine
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    PORT=3001 \
    HOST=0.0.0.0 \
    UPLOADS_DIR=/data/uploads \
    MIGRATIONS_DIR=/app/drizzle \
    LOG_LEVEL=info
WORKDIR /app
RUN apk add --no-cache curl \
  && addgroup -S app && adduser -S app -G app \
  && mkdir -p /data/uploads && chown -R app:app /data
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/drizzle ./drizzle
COPY apps/api/package.json ./package.json
USER app
EXPOSE 3001
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health || exit 1
CMD ["node", "dist/index.js"]
