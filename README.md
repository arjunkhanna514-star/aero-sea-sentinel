# 🛸 AERO-SEA SENTINEL — Complete Platform

> Maritime & aviation fuel optimisation. Quantum Compass · Smart Skin · Eagle Eye LiDAR · Quantum Swarm · Built-in local LLM (zero API keys).

---

## ⚡ One-Command Start

```bash
bash scripts/setup.sh        # Docker full stack
# OR
make up && make migrate-seed # Using Makefile
# OR  
bash scripts/dev.sh          # Local dev, hot-reload
```

**Open → http://localhost** and click any role card to enter.

---

## 🔐 Demo Accounts (password: `Sentinel2025!`)

| Role | Email |
|---|---|
| ADMIN | admin@sentinel.io |
| FLEET MANAGER | fleet@sentinel.io |
| ANALYST | analyst@sentinel.io |
| SENIOR OPERATOR | senior@sentinel.io |
| OPERATOR | operator@sentinel.io |

---

## 📁 Structure (82 files)

```
aero-sea-sentinel/
├── .env.example
├── .gitignore
├── docker-compose.yml          9-service production stack
├── docker-compose.override.yml Dev hot-reload overrides
├── Makefile                    Developer commands
│
├── database/
│   └── migrations/
│       ├── 001_init_schema.sql     17-table schema + TimescaleDB
│       └── 002_timescale_policies.sql  Compression + retention + aggregates
│   └── seeds/
│       └── 001_seed_data.sql
│
├── backend/src/
│   ├── index.js                Express + WS + metrics + alert service
│   ├── db/
│   │   ├── pool.js             PostgreSQL connection pool
│   │   ├── migrate.js          Migration runner with tracking table
│   │   ├── seed.js             Programmatic seeder (real bcrypt hashes)
│   │   └── hashPassword.js     CLI password hasher utility
│   ├── middleware/
│   │   ├── auth.js             JWT + 3-level RBAC (requireRole/requireMinRole/requirePermission)
│   │   ├── validate.js         express-validator schemas for every endpoint
│   │   └── logger.js           Winston structured logging
│   ├── controllers/
│   │   ├── authController.js        Login/logout/me + brute-force protection
│   │   ├── telemetryController.js   Live, history, fleet summary, ingest
│   │   ├── financialsController.js  KPIs, savings, projections, drag, case studies
│   │   ├── routesController.js      CRUD + Quantum Swarm approval flow
│   │   ├── vesselsController.js     Vessel CRUD + telemetry summary
│   │   ├── alertsController.js      Alert CRUD, acknowledge, stats
│   │   └── adminController.js       Users, nodes, overrides, system stats
│   ├── routes/index.js         40+ REST endpoints with role guards
│   ├── websocket/
│   │   └── telemetryBroadcaster.js  1-second broadcast to all WS clients
│   └── services/
│       ├── aiProxy.js               SSE streaming proxy → Python AI
│       ├── alertService.js          Auto-alert engine, 8 threshold rules
│       ├── auditService.js          Immutable audit trail
│       ├── metrics.js               Prometheus /metrics endpoint
│       └── redisPubSub.js           Redis pub/sub for horizontal scaling
│   └── tests/
│       ├── auth.test.js             Login, token, session tests
│       ├── rbac.test.js             Full role matrix (30+ cases)
│       ├── telemetry.test.js        Telemetry endpoints + gates
│       ├── financials.test.js       KPIs, savings targets, case studies
│       ├── alertService.test.js     All 8 alert rules + cooldown dedup
│       └── integration.test.js      Full API flow (requires live DB)
│
├── ai-service/
│   └── main.py                 FastAPI + Ollama, SSE streaming, live DB context
│
├── frontend/src/
│   ├── App.jsx                 Role router + error boundary
│   ├── hooks/useTelemetry.js   WebSocket hook, auto-reconnect
│   ├── contexts/AuthContext.jsx
│   ├── services/api.js         Full typed API client
│   └── components/
│       ├── shared/Shell.jsx    Sidebar + alert badge + AI drawer
│       ├── shared/Login.jsx    Login + quick-access role cards
│       ├── operator/           Cockpit, Quantum Compass, Eagle Eye LiDAR, Smart Skin
│       ├── analyst/            Financials, drag charts, 12-month projections
│       ├── senior-operator/    Fleet overview, Swarm approvals, Alert centre
│       └── fleet-manager/      Live SVG world map + Admin dashboard
│
├── simulator/simulator.js      Physics-based IoT data (5 vessels, 1s tick)
│
├── docker/                     Production + dev Dockerfiles for all services
├── nginx/                      Reverse proxy, rate limiting, SSE/WS passthrough
├── monitoring/
│   ├── prometheus/             Scrape config
│   └── grafana/                2 pre-built dashboards (fleet telemetry + financial KPIs)
└── scripts/
    ├── setup.sh                One-command launcher
    ├── dev.sh                  Local dev launcher
    └── migrate.js              Standalone migration script
```

---

## 🌐 URLs After Launch

| Service | URL |
|---|---|
| Platform | http://localhost |
| REST API | http://localhost:4000/api/v1 |
| API Health | http://localhost:4000/health |
| Prometheus Metrics | http://localhost:4000/metrics |
| AI Service | http://localhost:8000 |
| Grafana | http://localhost:3001 (admin / sentinel_grafana) |
| Prometheus UI | http://localhost:9090 |

---

## 📡 API Reference

### Auth
```
POST /auth/login          Body: {email, password} → {token, user}
POST /auth/logout         Invalidate session
GET  /auth/me             Current user
```

### Telemetry (all roles)
```
GET  /telemetry/live                      Latest per active vessel
GET  /telemetry/fleet/summary             Fleet aggregates
GET  /telemetry/:id/latest                Single vessel
GET  /telemetry/:id/history?hours=24      TimescaleDB time-bucket
POST /telemetry                           ADMIN only — raw ingest
```

### Financials
```
GET /financials/kpis          All roles
GET /financials/savings        All roles — includes €500k/€1.2M targets
GET /financials/projections    ANALYST+ only
GET /financials/drag           All roles
GET /financials/case-studies   All roles — Shanghai-LA + Horizon Eagle
```

### Vessels
```
GET   /vessels                All roles
GET   /vessels/:id            All roles
GET   /vessels/:id/telemetry  All roles — 24h hourly summary
POST  /vessels                FLEET_MANAGER+
PATCH /vessels/:id            FLEET_MANAGER+
```

### Routes + Quantum Swarm
```
GET   /routes                          All roles
POST  /routes                          OPERATOR+
PATCH /routes/:id/status               SENIOR_OPERATOR+  (APPROVED/REJECTED)
POST  /routes/swarm-requests           OPERATOR+
PATCH /routes/swarm-requests/:id/review  SENIOR_OPERATOR+
```

### Alerts
```
GET   /alerts                    All roles
GET   /alerts/stats              All roles
PATCH /alerts/:id/acknowledge    All roles
PATCH /alerts/acknowledge-all    All roles
POST  /alerts                    SENIOR_OPERATOR+ (manual create)
```

### Admin (ADMIN only)
```
GET    /admin/stats
GET/POST /admin/users
PATCH  /admin/users/:id
POST   /admin/users/:id/reset-password
DELETE /admin/users/:id
GET/PATCH /admin/server-nodes/:id
GET/POST  /admin/overrides
PATCH  /admin/overrides/:id/deactivate
GET    /admin/audit-logs
```

### AI Assistant
```
POST /ai/chat               Body: {message, session_id} → {response}
POST /ai/chat/stream        SSE token streaming
GET  /ai/history            Conversation history
```

---

## ⚡ WebSocket

Connect: `ws://localhost:4000/ws/telemetry?token=<jwt>`

Every 1000ms server broadcasts:
```json
{
  "type": "TELEMETRY_UPDATE",
  "telemetry": [{ "vessel_id":"...", "speed_knots":18.4, "drag_reduction_pct":17.2, ... }],
  "alerts": [...],
  "kpis": { "fleet_fuel_savings_eur": 498200 }
}
```

---

## 🤖 Local AI Setup

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull model (choose one):
ollama pull llama3:8b      # Best quality — 4.7GB
ollama pull mistral:7b     # Alternative — 4.1GB
ollama pull phi3           # Lightweight — 2.3GB

# Start AI service
cd ai-service
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The AI system prompt is injected with **live fleet data** on every query:
- Fleet KPIs, vessel statuses, active alerts
- Case study data: Shanghai-LA (€41,250/mo), Horizon Eagle (€102,400/mo)
- Savings targets: ships €500k/year, aircraft €1.2M/year

---

## 🔒 RBAC Matrix

| | ADMIN | FLEET MGR | ANALYST | SR. OP | OPERATOR |
|---|:---:|:---:|:---:|:---:|:---:|
| Users CRUD | ✅ | ❌ | ❌ | ❌ | ❌ |
| Server Nodes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Override Protocols | ✅ | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Route Approve | ✅ | ✅ | ❌ | ✅ | ❌ |
| Swarm Approve | ✅ | ❌ | ❌ | ✅ | ❌ |
| Financial Projections | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Vessel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Route | ✅ | ✅ | ❌ | ✅ | ✅ |
| Telemetry (read) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🚨 Auto-Alert Rules (8 rules, 5-min cooldown dedup)

| Rule | Trigger | Severity |
|---|---|---|
| LOW_FUEL | fuel < 20% | CRITICAL |
| FUEL_WARNING | 20% ≤ fuel < 30% | WARNING |
| QUANTUM_COHERENCE_LOW | coherence < 97% | CRITICAL |
| QUANTUM_TEMP_HIGH | temp > 4.2°K | WARNING |
| LIDAR_OBJECTS | ≥4 objects detected | WARNING |
| LIDAR_VISIBILITY_LOW | visibility < 50% | CRITICAL |
| DRAG_DEGRADED | drag reduction < 10% | WARNING |
| HIGH_WAVES | wave height > 5m | WARNING |

---

## 📊 Key Numbers

| Metric | Value |
|---|---|
| Ship annual savings target | **€500,000/vessel** |
| Aircraft annual savings target | **€1,200,000/unit** |
| Shanghai–LA monthly savings | **€41,250** |
| Horizon Eagle monthly savings | **€102,400** |
| Horizon Eagle annual (actual) | **€1,228,800** (+2.4% vs target) |
| Average ship drag reduction | **17.2%** |
| Average aircraft drag reduction | **18.4%** |
| Fleet CO₂ reduction | **~1,240 t/month** |
| Quantum Swarm confidence (Shanghai-LA) | **97.4%** |

---

## 🔧 Make Commands

```bash
make up              # Start all services (dev + hot-reload)
make up-prod         # Production stack
make down            # Stop all
make reset           # Full reset (wipes database)
make logs            # Follow all logs
make migrate         # Run DB migrations
make seed            # Seed demo data  
make migrate-seed    # Migrate + seed
make test            # Unit tests
make test-ci         # Tests + coverage (CI)
make pull-model      # Pull Llama 3 8B
make shell-db        # psql shell
make health          # Check all endpoints
make zip             # Package for distribution
```

---

## 🐳 Docker Services

| Container | Image | Port | Purpose |
|---|---|---|---|
| sentinel-postgres | timescale/timescaledb | 5432 | Primary DB + time-series |
| sentinel-redis | redis:7 | 6379 | WS pub/sub + caching |
| sentinel-backend | custom | 4000 | Express REST + WebSocket |
| sentinel-ai | custom | 8000 | FastAPI + Ollama bridge |
| sentinel-ollama | ollama/ollama | 11434 | LLM runtime |
| sentinel-frontend | custom | 3000 | React (nginx) |
| sentinel-nginx | nginx:1.27 | 80/443 | Reverse proxy |
| sentinel-simulator | custom | — | Physics telemetry generator |
| sentinel-grafana | grafana | 3001 | Dashboards |
