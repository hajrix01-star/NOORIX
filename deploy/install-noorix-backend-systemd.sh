#!/usr/bin/env bash
# تثبيت/تحديث خدمة systemd للـ API — مرة واحدة على VPS (أو بعد تعديل الوحدة)
set -euo pipefail

REPO="${NOORIX_ROOT:-/var/www/noorix}"
UNIT_SRC="$REPO/deploy/noorix-backend.service"
UNIT_DST=/etc/systemd/system/noorix-backend.service

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "ERROR: missing $UNIT_SRC" >&2
  exit 1
fi
if [[ ! -f "$REPO/backend/ecosystem.config.cjs" ]]; then
  echo "ERROR: missing $REPO/backend/ecosystem.config.cjs" >&2
  exit 1
fi
if ! command -v pm2-runtime >/dev/null 2>&1 && ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 غير مثبت عالمياً — على VPS: npm install -g pm2" >&2
  exit 1
fi

echo "==> Installing $UNIT_DST"
sudo cp "$UNIT_SRC" "$UNIT_DST"
sudo systemctl daemon-reload
sudo systemctl enable noorix-backend.service

echo "==> Stopping stray PM2/listeners (GitHub runner orphans)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete noorix-api noorix-backend 2>/dev/null || true
fi
API_PORT=3000
if [[ -f "$REPO/backend/.env" ]]; then
  p=$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' "$REPO/backend/.env" | head -1 | tr -d '\r')
  p=$(echo "$p" | sed "s/^[\"']//;s/[\"']$//" | tr -d '[:space:]')
  case "$p" in ''|*[!0-9]*) ;; *) API_PORT=$p ;; esac
fi
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${API_PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -t -i:"${API_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
fi
sleep 2

echo "==> systemctl restart noorix-backend"
sudo systemctl restart noorix-backend.service

ready=0
for i in $(seq 1 60); do
  if curl -sS -f -o /dev/null --max-time 3 "http://127.0.0.1:${API_PORT}/api/v1/health/live" 2>/dev/null; then
    echo "==> API live on 127.0.0.1:${API_PORT} after ${i}s"
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "ERROR: API not live — journal:" >&2
  sudo journalctl -u noorix-backend -n 40 --no-pager >&2 || true
  exit 1
fi

sudo systemctl status noorix-backend.service --no-pager | head -15
echo "==> Done. Deploys should use: sudo systemctl restart noorix-backend"
