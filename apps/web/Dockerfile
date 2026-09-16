FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --no-frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
RUN pnpm --filter @qr-menu/types build && pnpm --filter @qr-menu/web build

FROM node:22-alpine AS runner
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=app:app /workspace/node_modules ./node_modules
COPY --from=builder --chown=app:app /workspace/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=app:app /workspace/apps/web/package.json ./apps/web/package.json
USER app
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["../../node_modules/.bin/next", "start", "-p", "3000"]
