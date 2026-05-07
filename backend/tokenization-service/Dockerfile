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

RUN apk add --no-cache wget

RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nodejs

COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1:3003/health || exit 1

CMD ["node", "dist/server.js"]
