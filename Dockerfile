# syntax=docker/dockerfile:1

# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts

COPY . .

RUN npx prisma generate

RUN npm run build

# --- Production Stage ---
FROM node:22-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/dist ./dist

RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.cjs"]
