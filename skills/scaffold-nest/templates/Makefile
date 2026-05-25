# ──────────────────────────────────────────────────────────────────────────
#  Makefile — native + docker administration for this NestJS service
#  Run `make help` to list every target.
# ──────────────────────────────────────────────────────────────────────────

SHELL := /bin/bash
PM ?= pnpm

COMPOSE_SERVICES := docker compose -f config/docker-compose.yml
COMPOSE_FULL     := docker compose -f config/docker-compose.full.yml

.DEFAULT_GOAL := help

# ── Native ────────────────────────────────────────────────────────────────
.PHONY: dev
dev: ## Run the app in watch mode (native; assumes docker-services is up)
	$(PM) start:dev

.PHONY: start
start: ## Run the compiled app (requires `make build` first)
	$(PM) start:prod

.PHONY: stop
stop: ## Stop any foreground `make dev` (use Ctrl+C); this is a no-op placeholder
	@echo "Native dev server runs in foreground — use Ctrl+C to stop."

.PHONY: restart
restart: stop dev ## Restart the native dev server

.PHONY: build
build: ## Compile to dist/
	$(PM) build

# ── Docker: services only (postgres + redis, app runs native) ─────────────
.PHONY: docker-services
docker-services: ## Start postgres + redis in background (dev workflow)
	$(COMPOSE_SERVICES) up -d

.PHONY: docker-services-stop
docker-services-stop: ## Stop postgres + redis (preserves volumes)
	$(COMPOSE_SERVICES) down

.PHONY: docker-services-reset
docker-services-reset: ## Stop + wipe volumes for postgres + redis
	$(COMPOSE_SERVICES) down -v

# ── Docker: full stack (api + postgres + redis) ───────────────────────────
.PHONY: docker-start
docker-start: ## Start full stack in docker (api + postgres + redis)
	$(COMPOSE_FULL) up -d --build

.PHONY: docker-stop
docker-stop: ## Stop full stack (preserves volumes)
	$(COMPOSE_FULL) down

.PHONY: docker-restart
docker-restart: docker-stop docker-start ## Restart the full docker stack

.PHONY: docker-logs
docker-logs: ## Tail logs from the full stack
	$(COMPOSE_FULL) logs -f

# ── Tests / lint / typecheck ──────────────────────────────────────────────
.PHONY: test
test: ## Run the full test suite (jest)
	$(PM) test

.PHONY: test-smoke
test-smoke: ## Run smoke tests only
	$(PM) test:smoke

.PHONY: lint
lint: ## Run oxlint on src/
	$(PM) lint

.PHONY: typecheck
typecheck: ## Run tsc --noEmit
	$(PM) typecheck

# ── Migrations (TypeORM) ──────────────────────────────────────────────────
.PHONY: migration-run
migration-run: ## Apply pending migrations
	$(PM) migration:run

.PHONY: migration-revert
migration-revert: ## Revert the last migration
	$(PM) migration:revert

.PHONY: migration-generate
migration-generate: ## Generate a new migration from entity diffs. Usage: make migration-generate name=<Name>
	@test -n "$(name)" || (echo "usage: make migration-generate name=<Name>" && exit 1)
	$(PM) migration:generate src/database/migrations/$(name)

# ── Housekeeping ──────────────────────────────────────────────────────────
.PHONY: clean
clean: ## Remove dist/ and node_modules
	rm -rf dist node_modules

.PHONY: install
install: ## Install dependencies
	$(PM) install

# ── Help ──────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
