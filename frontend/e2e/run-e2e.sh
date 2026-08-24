#!/usr/bin/env bash
# CORE-02 browser E2E orchestration — synthetic data only.
#
# Brings up the disposable test PostgreSQL (docker-compose.test.yml),
# applies migrations, seeds synthetic DOCTOR/RECEPTIONIST accounts, starts
# the backend and a built frontend preview server, runs the Playwright
# suite, then tears the servers down. Does not touch any production system.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_PORT=3100
FRONTEND_PORT=4173

cleanup() {
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  # The suite creates real synthetic Patient/Encounter/CarePlan/CareTask
  # rows against the shared disposable test DB — reset back to the known
  # seeded state so a subsequent backend regression run (which assumes a
  # DB with no dangling clinical data) isn't left with leftover rows.
  (cd "$BACKEND_DIR" && npm run seed:e2e >/dev/null 2>&1) || true
}
trap cleanup EXIT

echo "== Starting disposable test PostgreSQL =="
docker compose -f "$ROOT_DIR/docker-compose.test.yml" up -d

echo "== Applying migrations =="
(cd "$BACKEND_DIR" && npx prisma migrate deploy)

echo "== Seeding synthetic E2E accounts =="
(cd "$BACKEND_DIR" && npm run seed:e2e)

echo "== Starting backend on :$BACKEND_PORT =="
# PILOT_DEFAULT_CLINICIAN_EMAIL must match E2E_DOCTOR_EMAIL in
# backend/test/e2e-seed.ts — default-clinician resolution is fail-closed
# (Finding 3 correction), so the Receptionist "new Encounter Context"
# browser flow needs a real, seeded DOCTOR configured explicitly here.
(cd "$BACKEND_DIR" && PORT=$BACKEND_PORT FRONTEND_ORIGIN="http://localhost:$FRONTEND_PORT" PILOT_DEFAULT_CLINICIAN_EMAIL="doctor.a@example.test" npm run start >/tmp/gastrocare-e2e-backend.log 2>&1) &
BACKEND_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf "http://localhost:$BACKEND_PORT/health" >/dev/null || {
  echo "Backend failed to become healthy"; cat /tmp/gastrocare-e2e-backend.log; exit 1;
}

echo "== Building frontend against backend :$BACKEND_PORT =="
(cd "$FRONTEND_DIR" && VITE_API_URL="http://localhost:$BACKEND_PORT" npm run build)

echo "== Starting frontend preview on :$FRONTEND_PORT =="
(cd "$FRONTEND_DIR" && npm run preview -- --port $FRONTEND_PORT --strictPort >/tmp/gastrocare-e2e-frontend.log 2>&1) &
FRONTEND_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null || {
  echo "Frontend failed to become healthy"; cat /tmp/gastrocare-e2e-frontend.log; exit 1;
}

echo "== Running Playwright suite =="
# This environment has no root/sudo, so Playwright's own --with-deps install
# cannot run apt. The required shared libraries (libnspr4, libnss3, etc.)
# were instead fetched with `apt-get download` (no root required) and
# extracted locally — see CHROMIUM_LIB_DIR below. Genuine environment
# constraint, not a workaround for a real missing capability.
CHROMIUM_LIB_DIR="${CHROMIUM_LIB_DIR:-/tmp/claude-1000/-home-blockchain-projects-gastrocare/8d6f339b-6aa1-4b13-9e0a-4acc32877283/scratchpad/chromium-libs/extracted/usr/lib/x86_64-linux-gnu}"
(cd "$FRONTEND_DIR" && E2E_API_URL="http://localhost:$BACKEND_PORT" LD_LIBRARY_PATH="$CHROMIUM_LIB_DIR:$CHROMIUM_LIB_DIR/nss:${LD_LIBRARY_PATH:-}" npx playwright test)
