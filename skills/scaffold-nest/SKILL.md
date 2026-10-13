---
name: scaffold-nest
description: >-
  Scaffold an enterprise-ready NestJS backend: SWC builder, oxlint, modular
  SOLID structure, configs isolated in ./config, Postgres (TypeORM) + Redis
  (ioredis) via docker-compose by default, universal exception filter, CORS,
  multi-env .env, Makefile with native + docker modes, @vendidit/test-tools
  smoke tests. Run /scaffold-nest <target-dir> [notes]. Parses the invocation
  for optional features: BullMQ queue, Swagger UI, OpenAPI-typescript.
---

# scaffold-nest skill

Scaffolds a fresh NestJS (v11+) backend into a directory the user specifies. Delivered with a small, composable core that covers enterprise basics — config loading, CORS, validation, exception filtering, logging, DB + cache, health checks, smoke tests — and optional switches for queues, API docs, and OpenAPI type generation.

---

## Invocation

```
/scaffold-nest <target-dir> [free-form notes about features]
```

Examples:

- `/scaffold-nest ~/Sites/foo/api` — scaffold at `~/Sites/foo/api`, defaults only.
- `/scaffold-nest ./server with bullmq` — add BullMQ queue module.
- `/scaffold-nest backend --swagger --openapi` — add Swagger UI + OpenAPI-ts generator.
- `/scaffold-nest .` — scaffold into current directory (confirm if non-empty).

---

## What to parse from the user's message

| Feature | Trigger phrases | Effect |
|---|---|---|
| Target dir | first positional arg | `mkdir -p` + write scaffold there |
| App name | `--name foo` / "called foo" / inferred from dir basename | package.json name, README heading, docker image tag |
| BullMQ queue | "bullmq", "queue", "jobs", "background tasks" | adds `@nestjs/bullmq` + `bullmq`, example consumer |
| Swagger | "swagger", "api docs" | adds `@nestjs/swagger` + `swagger-ui-express`, mounts `/docs` |
| OpenAPI types | "openapi", "typed api", "openapi-typescript" | adds `openapi-typescript` + generation script |
| Fastify | "fastify" | swaps `@nestjs/platform-express` → `@nestjs/platform-fastify` (default is Express — broader middleware compat) |

Defaults picked on purpose: Postgres + Redis docker-compose, Express platform, SWC builder, oxlint, CORS all origins. Scaffold runs natively by default; Docker build is available but not invoked.

---

## Scaffolding steps

Work directly — no subagent needed.

### 1. Resolve target dir + app name

- Target dir: first positional arg. Expand `~`. If relative, resolve against the invocation cwd.
- App name: from `--name`, explicit phrase, or `basename`. Kebab-case.
- If target exists and is non-empty, ask to confirm before proceeding.

### 2. Copy template + substitute

```bash
TEMPLATE="$HOME/.claude/skills/scaffold-nest/templates"
TARGET="<resolved target dir>"
mkdir -p "$TARGET"
cp -r "$TEMPLATE"/. "$TARGET"/
cd "$TARGET"
mv gitignore .gitignore
mv editorconfig .editorconfig
mv config/dockerignore .dockerignore
mv env.example .env.example
cp .env.example .env   # so pnpm dev works out of the box against docker services
find . -name '*.tmpl' -type f | while read -r f; do
    new="${f%.tmpl}"
    sed -e "s/__APP_NAME__/$APP_NAME/g" -e "s/__APP_TITLE__/$APP_TITLE/g" "$f" > "$new"
    rm "$f"
done
```

Rename notes:
- `gitignore` → `.gitignore` (at project root).
- `editorconfig` → `.editorconfig` (at project root).
- `config/dockerignore` → `.dockerignore` (at **project root** — Docker build context requires it there; noted in README).
- `env.example` → `.env.example` (at project root).
- `.env` is a copy of `.env.example` so first `pnpm dev` works against the default docker services.

### 3. Layer in requested features

**BullMQ (`bullmq` / `queue` / `jobs`):**
- Add `"@nestjs/bullmq": "^11.0.4"` + `"bullmq": "^5.76.1"` to deps.
- Create `src/queue/queue.module.ts` with `BullModule.forRootAsync({...})` reading `REDIS_HOST`/`REDIS_PORT`.
- Add `src/queue/queues.constants.ts` exporting queue name enum (`EXAMPLE_QUEUE`).
- Create an example processor at `src/queue/example.processor.ts` with a commented-out `@Processor('example')` scaffold so the user can see the shape.
- Wire `QueueModule` into `AppModule.imports`.

**Swagger (`swagger` / `api docs`):**
- Add `"@nestjs/swagger": "^11.4.1"` + `"swagger-ui-express": "^5"` to deps.
- In `src/main.ts`, add the SwaggerModule block guarded by `NODE_ENV !== 'production'` (or `SWAGGER_ENABLED` env). Mount at `/docs`.
- Decorate the example controller with `@ApiTags('...')` so the docs have something to show.

**OpenAPI types (`openapi` / `typed api` / `openapi-typescript`):**
- Add `"openapi-typescript": "^7.13.0"` to devDeps.
- Add scripts: `"openapi:generate": "openapi-typescript ./openapi.yml -o ./src/generated/openapi.d.ts"`.
- Create `openapi.yml` stub + `src/generated/.gitkeep`.

**Fastify (`fastify`):**
- Swap `@nestjs/platform-express` → `@nestjs/platform-fastify` in deps.
- In `main.ts`, use `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`.

Don't add any of these unless requested. Keep the base small.

### 4. Install deps

Detect package manager (pnpm-lock.yaml in ancestor → pnpm; else default pnpm). Run install:

```bash
cd "$TARGET"
pnpm install
```

Also run initial `pnpm build` to catch any obvious errors before reporting success.

### 5. Report

Summarize:
- Path it was written to
- Optional features enabled
- Commands: `make help`, `make docker-services` + `pnpm start:dev`, or `make docker-start`
- Where to look first (CLAUDE.md if one is added, README.md, `src/app.module.ts`)

---

## Architecture the scaffold enforces

**Directory layout** (final scaffold):

```
<target>/
├── config/
│   ├── nest-cli.json          # Nest CLI with SWC builder + swcrc path
│   ├── .swcrc                 # SWC transform config (decorators + metadata)
│   ├── tsconfig.json          # base TS config
│   ├── tsconfig.build.json    # prod build config
│   ├── oxlint.json
│   ├── jest.config.js
│   ├── docker-compose.yml     # postgres + redis (dev services)
│   ├── docker-compose.full.yml  # postgres + redis + api (full docker)
│   ├── Dockerfile             # multi-stage: deps → build → runtime
│   └── dockerignore
├── src/
│   ├── main.ts                # bootstrap: CORS, pipes, filters, interceptors, port
│   ├── app.module.ts          # root module: Config, Database, Cache, Health
│   ├── app.controller.ts      # GET / — app name/version
│   ├── app.service.ts
│   ├── common/
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts     # universal error → { error: { code, message, ... } }
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts       # method/path/status/duration
│   │   │   └── response.interceptor.ts      # wraps success → { data, timestamp }
│   │   ├── constants/index.ts
│   │   └── dto/error-response.dto.ts
│   ├── config/
│   │   ├── config.module.ts                 # @nestjs/config + Joi validation
│   │   ├── env.validation.ts                # Joi schema
│   │   └── loaders/
│   │       ├── app.config.ts                # PORT, NODE_ENV, API_PREFIX, CORS_ORIGINS
│   │       ├── database.config.ts           # DB_HOST, DB_PORT, DB_USER, ...
│   │       └── redis.config.ts              # REDIS_HOST, REDIS_PORT, REDIS_DB
│   ├── database/
│   │   ├── database.module.ts               # TypeOrmModule.forRootAsync
│   │   ├── data-source.ts                   # CLI DataSource for migrations
│   │   └── migrations/
│   ├── cache/
│   │   ├── cache.module.ts                  # provides REDIS_CLIENT
│   │   └── redis.provider.ts                # ioredis singleton
│   ├── health/
│   │   ├── health.controller.ts             # GET /health (liveness), /health/ready (readiness)
│   │   └── health.module.ts
│   └── modules/                             # feature modules land here
│       └── README.md
├── tests/
│   ├── framework/                           # @vendidit/test-tools hooks
│   │   ├── globalSetup.js
│   │   └── setupGlobals.js
│   ├── specs/
│   │   └── smoke.spec.ts                    # GET /health → 200
│   └── README.md
├── .env                                     # (dev defaults, copy of .env.example)
├── .env.example
├── .env.staging                             # scaffolded empty — user fills in
├── .env.production                          # scaffolded empty
├── .gitignore
├── .editorconfig                            # tab indentation, width 4 (YAML: 2 spaces)
├── .dockerignore
├── Makefile                                 # native + docker modes, make help
├── testtools.config.json                    # @vendidit/test-tools project name
├── package.json
└── README.md
```

**Rules embodied:**

1. **Indentation = tabs (width 4)** — same rule as `scaffold-preact`. All generated code, configs (JSON, .swcrc) and templates use tab indentation, enforced project-wide by `.editorconfig` (`indent_style = tab`, `tab_width = 4`). Only exception: YAML (`docker-compose*.yml`) uses 2 spaces, because YAML forbids tabs. Any code you write or format for this scaffold must use tabs, not spaces.
2. **SWC builder** via nest-cli.json's SWC option + `config/.swcrc`. Fast compilation, preserves decorator metadata.
3. **Configs in `config/`** — scripts invoke with `nest ... -c config/nest-cli.json`, `tsc -p config/tsconfig.json`, `oxlint --config config/oxlint.json`. Exceptions (required at project root): `.env`, `.gitignore`, `.editorconfig`, `.dockerignore`, `Makefile`, `testtools.config.json`, `package.json`.
4. **CORS** — enabled with origin `'*'` (all domains) in `main.ts`. Override via `CORS_ORIGINS` env (comma-separated).
5. **Global exception filter** `AllExceptionsFilter` — standardizes error shape to `{ error: { code, message, details?, timestamp, path } }`, logs everything via `Logger`. Add domain-specific filters later, but they should inherit this shape.
6. **Global response interceptor** `ResponseInterceptor` — wraps success responses as `{ data: T, timestamp: ISO }`. Consistent contract for every endpoint.
7. **Global logging interceptor** — method, path, status, duration. Built on the NestJS `Logger`. Pluggable if pino is later wanted.
8. **Global validation pipe** — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
9. **Config via `@nestjs/config` + Joi** — never `process.env.FOO` directly in code; go through `configService.get('namespace.key')`. Validation fails fast at boot if env is malformed.
10. **Multi-env** — `.env.staging`, `.env.production` files live at project root. Script variants: `start:stage`, `start:prod` use `dotenv-cli` to load alternate env files.
11. **Postgres default via Docker** — `docker-compose.yml` runs `postgres:16-alpine` on :5432, `redis:7-alpine` on :6379. `make docker-services` to bring them up alongside a native app.
12. **Universal error handling** — all errors route through `AllExceptionsFilter`. Future auditing / Sentry integration plugs in here.
13. **Test scaffold** — `@vendidit/test-tools` as devDep, `tests/specs/smoke.spec.ts` boots the app and hits `/health`. `testtools.config.json` at project root for the test-tools runner.
14. **Dockerfile present, not default** — `Dockerfile` exists in `config/`. Default workflow is native (`pnpm start:dev`) with docker services (`make docker-services`). Full-docker mode is `make docker-start`.
15. **Comment conventions** — every controller route and service method gets a brief docstring-style comment explaining what it does. Special / non-obvious logic gets inline comments explaining why.

---

## Makefile contract

`make help` lists every target with a short description. The scaffold ships:

- `make dev` / `make start` / `make stop` / `make restart` — native mode
- `make build` — compile `dist/`
- `make docker-services` / `make docker-services-stop` — postgres + redis only
- `make docker-start` / `make docker-stop` / `make docker-restart` — full stack in docker
- `make docker-logs` — tail
- `make test` / `make test-smoke`
- `make lint` / `make typecheck`
- `make migration-run` / `make migration-revert` / `make migration-generate name=<Name>`
- `make clean` — drop dist/, node_modules

---

## Post-scaffold: what the user gets

```
cd <target>
make help                       # enumerate all commands
make docker-services            # start postgres + redis in background
pnpm start:dev                  # native dev server (watch)
curl localhost:3000/health      # should return 200
```

Full Docker (no native node required):

```
make docker-start
```

---

## Non-goals

- Not a UI framework. Backend only.
- Not a full auth module — `@vendidit/auth` or equivalent wiring is a separate concern.
- Not a production-grade observability stack — pino + OpenTelemetry come later, but the interceptor/filter hooks are ready.
- Not a test-coverage mandate — the smoke test proves the app boots; feature tests are per-feature.
