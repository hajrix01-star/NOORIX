#!/usr/bin/env bash
# يحرّر منفذ الـ API ويعيد تشغيل noorix-backend من مسار الإنتاج.
# Usage: API_PORT=3000 DEPLOY_SHA=abc123 bash deploy/ensure-api-listener.sh
set -euo pipefail

PROD="${NOORIX_BACKEND_DIR:-/var/www/noorix/backend}"
API_PORT="${API_PORT:-3000}"

if [[ ! -f "$PROD/ecosystem.config.cjs" ]]; then
  echo "ERROR: missing $PROD/ecosystem.config.cjs" >&2
  exit 1
fi

free_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -t -i:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
  sleep 2
}

echo "==> Stopping PM2 apps and freeing TCP ${API_PORT}"
pm2 delete noorix-api noorix-backend 2>/dev/null || true
sleep 2
free_port "$API_PORT"

cd "$PROD"
echo "==> PM2 start (DEPLOY_SHA=${DEPLOY_SHA:-})"
DEPLOY_SHA="${DEPLOY_SHA:-}" pm2 start ecosystem.config.cjs
pm2 save

echo "==> Waiting for liveness on 127.0.0.1:${API_PORT}..."
ready=0
for i in $(seq 1 60); do
  if curl -sS -f -o /dev/null --connect-timeout 2 --max-time 3 \
    "http://127.0.0.1:${API_PORT}/api/v1/health/live" 2>/dev/null; then
    echo "==> API live after ${i}s"
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "ERROR: API did not become live" >&2
  pm2 logs noorix-backend --lines 60 --nostream 2>&1 | tail -60 || true
  exit 1
fi

CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 \
  "http://127.0.0.1:${API_PORT}/api/v1/dashboard/calendar/saudi-occasions?year=2026" || echo 000)"
echo "saudi-occasions HTTP ${CODE} (expect 401/403, not 404)"
if [[ "$CODE" == "404" ]]; then
  echo "ERROR: saudi-occasions route missing — dist may be stale" >&2
  if [[ -d "$PROD/dist/dashboard" ]]; then
    grep -r 'saudi-occasions' "$PROD/dist/dashboard" 2>/dev/null | head -3 || echo "(not found in dist)"
  fi
  pm2 list || true
  exit 1
fi

LIVE_JSON="$(curl -sS --max-time 5 "http://127.0.0.1:${API_PORT}/api/v1/health/live" || true)"
echo "live: ${LIVE_JSON}"
