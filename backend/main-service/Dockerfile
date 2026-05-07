FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Production stage ──────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# wget is needed for HEALTHCHECK below; size is ~80KB on alpine.
RUN apk add --no-cache wget

# Create a dedicated non-root user. Service writes to /app/logs/* via
# winston; chown that path so the user can create files.
RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nodejs

COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

# Pre-create logs dir owned by the non-root user so winston can write
# without a runtime EACCES on first request.
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

USER nodejs

EXPOSE 3001

# /health is mounted in app.ts and intentionally does not touch the DB,
# so it stays cheap to poll.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/server.js"]
