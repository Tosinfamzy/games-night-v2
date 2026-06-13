# Games Night

A real-time multiplayer **games night** backend. Host a session, gather players into teams, run games, keep score live, and chat — all in real time over WebSockets. Built with [NestJS](https://nestjs.com/) 11 and TypeScript, backed by PostgreSQL and Redis.

## Features

- **Sessions** — a games master creates a session that players join with a code.
- **Players & teams** — assign players to teams with colors and limits.
- **Games & game library** — pick games from a library and run them within a session.
- **Live scoring** — award and adjust scores in real time, broadcast to everyone.
- **In-session chat** — real-time chat over WebSockets.
- **History** — past sessions, games, and results.
- **Auth** — JWT access + refresh tokens (signup, login, refresh, change password).
- **Health checks** — liveness/readiness endpoints for orchestrators.

## Tech stack

| Concern        | Choice                                            |
| -------------- | ------------------------------------------------- |
| Framework      | NestJS 11, TypeScript                             |
| Database       | PostgreSQL via TypeORM (migrations-managed)       |
| Cache          | Redis via `cache-manager` / `@keyv/redis`         |
| Real-time      | Socket.IO (`@nestjs/websockets`)                  |
| Auth           | JWT + Passport (`passport-jwt`), bcrypt           |
| Validation     | `class-validator` / `class-transformer`, Joi env  |
| API docs       | Swagger (`@nestjs/swagger`)                        |
| Rate limiting  | `@nestjs/throttler`                               |
| Events         | `@nestjs/event-emitter`                           |

## Architecture

The app is split into focused feature modules under [src/](src/):

```
auth          JWT auth, guards, strategies
session       session lifecycle (+ session.gateway.ts)
player        players within a session
team          teams, colors, membership
game          game instances (+ game.gateway.ts)
game-library  catalog of available games
games-master  games-master operations
score         scoring + broadcasts
chat          real-time chat (chat.gateway.ts)
history       past sessions/results
user          user accounts
health        liveness/readiness
common        shared constants, DTOs, base gateway, utils
```

Three WebSocket gateways (`session`, `game`, `chat`) extend a shared `base.gateway.ts`.
Service↔gateway communication prefers `EventEmitter2`; see [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
and [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md) for the conventions and rationale.

## Getting started

### Prerequisites

- Node.js **>= 22**
- Docker (for Postgres + Redis), or your own local Postgres 15 and Redis 7

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Create your env file and adjust as needed
cp .env.example .env

# 4. Apply database migrations
npm run migration:run

# 5. Run the app (watch mode)
npm run start:dev
```

The server starts on `http://localhost:3000`. Routes are URI-versioned with a default of `v1`
(e.g. `GET /v1/health`, `POST /v1/auth/login`).

## Environment variables

Validated on boot via Joi in [src/app.module.ts](src/app.module.ts). See [.env.example](.env.example).

| Variable                 | Required | Default       | Description                                          |
| ------------------------ | -------- | ------------- | ---------------------------------------------------- |
| `NODE_ENV`               | no       | `development` | `development` \| `production` \| `test`              |
| `PORT`                   | no       | `3000`        | HTTP port                                            |
| `FRONTEND_URL`           | no       | —             | Extra CORS origin (localhost/LAN/vercel allowed too) |
| `DB_HOST`                | no       | `localhost`   | Postgres host                                        |
| `DB_PORT`                | no       | `5432`        | Postgres port                                        |
| `DB_USER`                | no       | `postgres`    | Postgres user                                        |
| `DB_PASSWORD`            | **yes**  | —             | Postgres password                                    |
| `DB_NAME`                | no       | `games_night` | Database name                                        |
| `DB_SYNCHRONIZE`         | no       | —             | Dev/test only; `false` disables auto-sync            |
| `REDIS_HOST`             | no       | `localhost`   | Redis host                                           |
| `REDIS_PORT`             | no       | `6379`        | Redis port                                           |
| `REDIS_PASSWORD`         | no       | —             | Redis password (if any)                              |
| `JWT_SECRET`             | **yes**  | —             | Secret for signing JWTs                              |
| `JWT_EXPIRATION`         | no       | `15m`         | Access token TTL                                     |
| `JWT_REFRESH_EXPIRATION` | no       | `7d`          | Refresh token TTL                                    |

## API documentation

Interactive Swagger UI is available at **`http://localhost:3000/api`** while the server runs.
A written overview lives in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## Scripts

```bash
# Development
npm run start:dev        # watch mode
npm run start:debug      # watch + debugger
npm run build            # compile to dist/
npm run start:prod       # run compiled build

# Database (TypeORM migrations)
npm run migration:generate -- src/migrations/<Name>
npm run migration:run
npm run migration:revert
npm run migration:show
npm run db:reset         # drop + recreate (dev only)

# Quality
npm run lint
npm run format
```

## Testing

```bash
npm test                 # unit tests
npm run test:e2e         # end-to-end tests
npm run test:cov         # coverage
```

See [TESTING_SUMMARY.md](TESTING_SUMMARY.md) for the testing strategy and coverage notes.

## Deployment

A multi-stage [Dockerfile](Dockerfile) builds a slim, non-root production image. In production the
app runs migrations on boot (`migrationsRun`) and never auto-syncs the schema. The repo also ships a
[railway.toml](railway.toml) for one-click Railway deploys (health check at `/v1/health`).

Full deployment notes: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project documentation

- [CLAUDE.md](CLAUDE.md) — project rules and conventions
- [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) — coding standards
- [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md) — service decomposition & DI decisions
- [docs/AUTH_USAGE.md](docs/AUTH_USAGE.md) · [docs/MIGRATION_AUTH.md](docs/MIGRATION_AUTH.md) — auth
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deployment
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — API reference

## License

UNLICENSED — private project.
