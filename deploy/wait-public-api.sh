#!/usr/bin/env bash
set -euo pipefail

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
