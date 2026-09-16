FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --no-frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
RUN pnpm --filter @qr-menu/types build && pnpm --filter @qr-menu/database build && pnpm --filter @qr-menu/api build

FROM node:22-alpine AS runner
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=app:app /workspace/node_modules ./node_modules
COPY --from=builder --chown=app:app /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=app:app /workspace/packages/database ./packages/database
USER app
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
