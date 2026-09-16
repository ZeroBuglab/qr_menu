# KÖR QR Menu

Production-oriented monorepo for a multilingual QR menu and restaurant operations platform. The repository contains a mobile-first customer menu, an owner dashboard, kitchen display, waiter desk, a Fastify API, PostgreSQL/Prisma data model, and a Socket.IO event layer.

## Architecture

```text
Browser (customer / admin / kitchen / waiter)
                    │ HTTPS + Socket.IO
                    ▼
               Nginx edge
             ┌──────┴──────┐
             ▼             ▼
       Next.js web     Fastify API ─── Socket.IO rooms
                            │
                         Prisma
                            │
                        PostgreSQL
```

The system is tenant-scoped through `restaurantId`. Public menu reads use a restaurant slug; staff operations use an opaque session cookie and a restaurant membership/role check on the server. The browser never decides an order's final status or total.

## Project structure

```text
apps/web                 Next.js app: /menu, /admin, /kitchen, /waiter
apps/api                 Fastify REST API, auth, validation, WebSocket events
packages/database        Prisma schema and demo seed
packages/types           Shared domain types
nginx                    Reverse proxy with WebSocket support
docs                     Architecture and operational notes
```

## Local installation

Requirements: Node.js 22+, pnpm 9+, PostgreSQL 16. Docker is recommended for the database.

```bash
corepack enable
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm --filter @qr-menu/database prisma generate
pnpm --filter @qr-menu/database prisma migrate dev --name init
$env:DEMO_PASSWORD = "use-a-long-random-local-password"
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000/menu/coffee-house?table=12`. The staff surfaces are available at `/admin`, `/kitchen`, and `/waiter`. API documentation is available at `http://localhost:4000/docs` when the API is running.

On Windows, after the first installation you can start the local stack with `powershell -ExecutionPolicy Bypass -File .\start-local.ps1`. Open port `3000`; `http://localhost` without a port is not the Next.js app.

For a disposable full stack, create `.env` with at least `COOKIE_SECRET` and run:

```bash
docker compose up --build
```

The compose profile applies the schema and seeds the demo restaurant automatically for a fresh local database. Use reviewed Prisma migrations and a separate seed job in staging and production.

## Environment variables

See [.env.example](.env.example). Never commit `.env`, credentials, demo passwords, or provider secrets. In production set a random `COOKIE_SECRET`, a strong database password, HTTPS, and a restricted database network.

## API surface

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/health` | public liveness |
| POST | `/api/v1/auth/login` | staff |
| POST | `/api/v1/auth/logout` | staff session |
| GET | `/api/v1/auth/me` | staff session |
| GET | `/api/v1/restaurants/:slug/menu` | public menu |
| POST | `/api/v1/orders` | public, validated |
| PATCH | `/api/v1/orders/:id/status` | authenticated staff, tenant-scoped |
| GET | `/docs` | development/API reference |

Order events are emitted to `restaurant:{restaurantId}` and `order:{orderId}` rooms. A payment provider is intentionally represented by the `Payment` model and a future adapter boundary; no fake payment success is returned.

## Testing and quality gates

```bash
pnpm lint
pnpm test
pnpm build
```

Before production, add a CI PostgreSQL service and run migration, seed-free integration tests, API authorization tests, and Playwright E2E tests against a disposable tenant. The required security test matrix is recorded in [SECURITY.md](SECURITY.md).

## Demo credentials

The seed reads `DEMO_PASSWORD` and stores only an Argon2id hash. It defaults to a deliberately non-production placeholder, `change-me-before-use`; set your own value before seeding and rotate it immediately after local demonstration. The demo accounts are `admin@demo.local`, `kitchen@demo.local`, and `waiter@demo.local`.
