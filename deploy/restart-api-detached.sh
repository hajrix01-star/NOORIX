#!/usr/bin/env bash
# يشغّل ensure-api-listener.sh عبر systemd-run حتى لا يقتله GitHub Actions runner
# عند انتهاء مهمة النشر (orphan process cleanup).
#
# Usage (على VPS أو من workflow):
#   DEPLOY_SHA=abc API_PORT=8080 bash deploy/restart-api-detached.sh
#   DEPLOY_SHA=abc bash deploy/restart-api-detached.sh --wait-public
set -euo pipefail

REPO="${NOORIX_ROOT:-/var/www/noorix}"
WAIT_PUBLIC=0
if [[ "${1:-}" == "--wait-public" ]]; then
  WAIT_PUBLIC=1
fi

API_PORT="${API_PORT:-3000}"
if [[ -f "$REPO/backend/.env" ]]; then
  p=$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' \
    "$REPO/backend/.env" | head -1 | tr -d '\r')
  p=$(echo "$p" | tr -d '[:space:]')
  case "$p" in ''|*[!0-9]*) ;; *) API_PORT=$p ;; esac
fi

export API_PORT DEPLOY_SHA="${DEPLOY_SHA:-}" NOORIX_BACKEND_DIR="$REPO/backend"

UNIT="noorix-api-restart-$(date +%s)"
echo "==> systemd-run unit=${UNIT} (API_PORT=${API_PORT})"
sudo systemd-run \
  --unit="$UNIT" \
  --description="Noorix API restart" \
  --collect \
  --setenv=API_PORT \
  --setenv=DEPLOY_SHA \
  --setenv=NOORIX_BACKEND_DIR \
  bash "$REPO/deploy/ensure-api-listener.sh"

if [[ "$WAIT_PUBLIC" != 1 ]]; then
  echo "==> Restart dispatched (detached). Use --wait-public to block until hajrix.com responds."
  exit 0
fi

echo "==> Waiting for https://hajrix.com/api/v1/health/live ..."
ready=0
for i in $(seq 1 90); do
  if curl -sS -f -o /dev/null --max-time 8 "https://hajrix.com/api/v1/health/live" 2>/dev/null; then
    echo "==> Public API live after $((i * 2))s"
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" != 1 ]]; then
  echo "ERROR: public health/live still failing" >&2
  exit 1
fi

CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 \
  "https://hajrix.com/api/v1/dashboard/calendar/saudi-occasions?year=2026" || echo 000)"
echo "saudi-occasions (public) HTTP ${CODE}"
if [[ "$CODE" == "404" || "$CODE" == "502" || "$CODE" == "000" ]]; then
  echo "ERROR: API route or gateway unhealthy" >&2
  exit 1
fi
