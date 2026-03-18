#!/usr/bin/env bash
# scripts/dev.sh — Run all services locally (no Docker, hot-reload)
# Requires: PostgreSQL, Redis, Ollama, Node 20+, Python 3.11+
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 0
}
trap cleanup SIGINT SIGTERM

log() { echo -e "\033[1;36m[$1]\033[0m $2"; }

# Start backend
log "BACKEND" "Starting Node.js API (port 4000)..."
cd "$ROOT/backend"
[ ! -f .env ] && cp .env.example .env
npm run dev &
PIDS+=($!)

# Start AI service
log "AI" "Starting FastAPI + Ollama bridge (port 8000)..."
cd "$ROOT/ai-service"
[ ! -d venv ] && python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
PIDS+=($!)
deactivate

# Start frontend
log "FRONTEND" "Starting Vite dev server (port 3000)..."
cd "$ROOT/frontend"
npm run dev &
PIDS+=($!)

# Start simulator after a delay
log "SIMULATOR" "Starting telemetry simulator (starts in 8s)..."
sleep 8
cd "$ROOT/simulator"
[ ! -d node_modules ] && npm install
node simulator.js &
PIDS+=($!)

echo ""
echo "  ✓ All services running"
echo "  Frontend:  http://localhost:3000"
echo "  API:       http://localhost:4000/api/v1"
echo "  AI:        http://localhost:8000"
echo ""
echo "  Press Ctrl+C to stop all services"

# Keep alive
wait
