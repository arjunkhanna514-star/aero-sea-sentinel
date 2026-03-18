# ============================================================
# AERO-SEA SENTINEL — Makefile
# Common developer operations
# ============================================================

.PHONY: help up down reset build logs ps test migrate seed shell-db shell-backend

DOCKER_COMPOSE = docker-compose

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Docker lifecycle ─────────────────────────────────────────
up: ## Start all services (dev mode with hot-reload)
	$(DOCKER_COMPOSE) up --build -d
	@echo "\n✓ Platform running → http://localhost"
	@echo "  API     → http://localhost:4000/api/v1"
	@echo "  Grafana → http://localhost:3001\n"

up-prod: ## Start production stack (no volume mounts)
	$(DOCKER_COMPOSE) -f docker-compose.yml up --build -d

down: ## Stop all services
	$(DOCKER_COMPOSE) down

reset: ## Full reset — removes all volumes (DATABASE WILL BE WIPED)
	@echo "⚠️  This will DELETE all data. Press Ctrl+C to cancel, Enter to confirm."
	@read _confirm
	$(DOCKER_COMPOSE) down -v --remove-orphans
	@echo "✓ All volumes removed"

build: ## Rebuild all Docker images
	$(DOCKER_COMPOSE) build --parallel --no-cache

logs: ## Follow all service logs
	$(DOCKER_COMPOSE) logs -f --tail=100

logs-backend: ## Follow backend logs only
	$(DOCKER_COMPOSE) logs -f --tail=100 backend

logs-ai: ## Follow AI service logs
	$(DOCKER_COMPOSE) logs -f --tail=50 ai-service

ps: ## Show running containers and health
	$(DOCKER_COMPOSE) ps

# ─── Database ─────────────────────────────────────────────────
migrate: ## Run database migrations
	$(DOCKER_COMPOSE) exec backend node src/db/migrate.js

seed: ## Seed database with demo data
	$(DOCKER_COMPOSE) exec backend node src/db/seed.js

migrate-seed: migrate seed ## Run migrations then seed

shell-db: ## Open psql shell in database container
	$(DOCKER_COMPOSE) exec postgres psql -U sentinel_user -d aero_sea_sentinel

# ─── Backend ──────────────────────────────────────────────────
shell-backend: ## Open shell in backend container
	$(DOCKER_COMPOSE) exec backend sh

test: ## Run backend test suite
	cd backend && npm test

test-watch: ## Run tests in watch mode
	cd backend && npm run test:watch

test-ci: ## Run tests with coverage (CI mode)
	cd backend && npm run test:ci

# ─── AI ───────────────────────────────────────────────────────
pull-model: ## Pull the Llama 3 8B model into Ollama
	$(DOCKER_COMPOSE) exec ollama ollama pull llama3:8b

list-models: ## List locally available LLM models
	$(DOCKER_COMPOSE) exec ollama ollama list

# ─── Local dev (no Docker) ────────────────────────────────────
dev: ## Run all services locally without Docker
	bash scripts/dev.sh

install: ## Install all npm/pip dependencies locally
	cd backend   && npm install
	cd frontend  && npm install
	cd simulator && npm install
	cd ai-service && pip install -r requirements.txt

# ─── Utilities ────────────────────────────────────────────────
health: ## Check health of all services
	@echo "Backend:  $$(curl -s http://localhost:4000/health | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[\"status\"])')"
	@echo "AI:       $$(curl -s http://localhost:8000/health | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[\"status\"])')"
	@echo "Frontend: $$(curl -so /dev/null -w '%{http_code}' http://localhost:3000)"

zip: ## Package project for distribution (excluding node_modules)
	zip -r aero-sea-sentinel-v1.0.zip . \
		--exclude "*/node_modules/*" \
		--exclude ".git/*" \
		--exclude "*.zip" \
		--exclude "logs/*"
	@echo "✓ Created aero-sea-sentinel-v1.0.zip"
