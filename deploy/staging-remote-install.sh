#!/usr/bin/env bash
# Install Noorix staging into an isolated path and systemd service.
# Required remote files:
#   /tmp/noorix-staging-source.tar.gz
#   /tmp/noorix-staging-frontend.tar.gz
set -euo pipefail

: "${DEPLOY_SHA:?DEPLOY_SHA is required}"
APP_ROOT="${APP_ROOT:-/var/www/noorix-staging}"
API_PORT="${API_PORT:-3001}"
PUBLIC_URL="${PUBLIC_URL:-}"
SERVICE_NAME="${SERVICE_NAME:-noorix-staging-backend}"
FRONTEND_ROOT="${APP_ROOT}/dist"
BACKEND_ROOT="${APP_ROOT}/backend"
PACKAGES_ROOT="${APP_ROOT}/packages"
DEPLOY_ROOT="${APP_ROOT}/deploy"
SOURCE_TARBALL="/tmp/noorix-staging-source.tar.gz"
FRONTEND_TARBALL="/tmp/noorix-staging-frontend.tar.gz"

log() { printf '%s\n' "$*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing command: $1" >&2
    exit 1
  }
}

need tar
need rsync
need npm
need node
need systemctl

if [[ ! -f "$SOURCE_TARBALL" || ! -f "$FRONTEND_TARBALL" ]]; then
  echo "ERROR: staging tarballs are missing under /tmp." >&2
  exit 1
fi

if [[ "$APP_ROOT" == "/var/www/noorix" || "$APP_ROOT" == "/var/www/noorix/" ]]; then
  echo "ERROR: refusing to deploy staging into the live app root." >&2
  exit 1
fi

case "$API_PORT" in
  ''|*[!0-9]*)
    echo "ERROR: API_PORT must be numeric." >&2
    exit 1
    ;;
  3000)
    echo "ERROR: refusing to use live API port 3000 for staging." >&2
    exit 1
    ;;
esac

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

log "==> Extracting source to $TMP"
tar xzf "$SOURCE_TARBALL" -C "$TMP"

log "==> Preparing app root: $APP_ROOT"
sudo mkdir -p "$APP_ROOT" "$BACKEND_ROOT" "$PACKAGES_ROOT" "$DEPLOY_ROOT" "$FRONTEND_ROOT"

log "==> Sync backend, packages, and deploy scripts"
sudo rsync -a --delete --exclude='.env' "$TMP/backend/" "$BACKEND_ROOT/"
sudo rsync -a --delete "$TMP/packages/" "$PACKAGES_ROOT/"
sudo rsync -a --delete "$TMP/deploy/" "$DEPLOY_ROOT/"

if [[ ! -f "$BACKEND_ROOT/.env" ]]; then
  cat >&2 <<EOF
ERROR: Missing $BACKEND_ROOT/.env
Create a staging .env first. Minimum:
  NODE_ENV=production
  PORT=${API_PORT}
  DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/noorix_staging
  JWT_SECRET=...
  CORS_ORIGIN=${PUBLIC_URL:-http://localhost:${API_PORT}}
EOF
  exit 1
fi

if grep -Eq 'DATABASE_URL=.*(/|%2F)noorix([?"]|$)' "$BACKEND_ROOT/.env"; then
  cat >&2 <<EOF
ERROR: $BACKEND_ROOT/.env appears to use the live database name "noorix".
Use a separate database such as "noorix_staging".
EOF
  exit 1
fi

if grep -q '^PORT=' "$BACKEND_ROOT/.env"; then
  sudo sed -i "s/^PORT=.*/PORT=${API_PORT}/" "$BACKEND_ROOT/.env"
else
  printf '\nPORT=%s\n' "$API_PORT" | sudo tee -a "$BACKEND_ROOT/.env" >/dev/null
fi

if [[ -n "$PUBLIC_URL" ]]; then
  if grep -q '^CORS_ORIGIN=' "$BACKEND_ROOT/.env"; then
    sudo sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${PUBLIC_URL}|" "$BACKEND_ROOT/.env"
  else
    printf 'CORS_ORIGIN=%s\n' "$PUBLIC_URL" | sudo tee -a "$BACKEND_ROOT/.env" >/dev/null
  fi
fi

log "==> Install and build shared packages"
npm install --prefix "$PACKAGES_ROOT/finance-core"
npm install --prefix "$PACKAGES_ROOT/permissions-core"

log "==> Install and build backend"
cd "$BACKEND_ROOT"
rm -rf node_modules
npm ci
npx prisma generate
bash "$DEPLOY_ROOT/prisma-migrate-deploy-with-recovery.sh"
npm run build

log "==> Install frontend into $FRONTEND_ROOT"
FTMP="$(mktemp -d)"
tar xzf "$FRONTEND_TARBALL" -C "$FTMP"
sudo rsync -a --delete "$FTMP/" "$FRONTEND_ROOT/"
rm -rf "$FTMP"

if [[ ! -f "$FRONTEND_ROOT/index.html" ]]; then
  echo "ERROR: frontend index.html missing after deploy." >&2
  exit 1
fi

if ! grep -qF "$DEPLOY_SHA" "$FRONTEND_ROOT/index.html"; then
  echo "ERROR: frontend build tag does not match $DEPLOY_SHA." >&2
  exit 1
fi

log "==> Install systemd service: $SERVICE_NAME"
UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=Noorix Staging API
Documentation=https://github.com/hajrix01-star/NOORIX
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${BACKEND_ROOT}
Environment=NODE_ENV=production
Environment=PM2_HOME=/etc/.pm2-staging
Environment=DEPLOY_SHA=${DEPLOY_SHA}
EnvironmentFile=-${BACKEND_ROOT}/.env
ExecStart=/bin/bash -lc 'cd ${BACKEND_ROOT} && exec pm2-runtime start ecosystem.config.cjs --name ${SERVICE_NAME}'
Restart=always
RestartSec=5
KillMode=mixed
TimeoutStopSec=45
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

log "==> Waiting for staging API on 127.0.0.1:${API_PORT}"
ready=0
for i in $(seq 1 90); do
  if curl -sS -f -o /dev/null --max-time 3 "http://127.0.0.1:${API_PORT}/api/v1/health/live" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" != 1 ]]; then
  echo "ERROR: staging API did not become healthy." >&2
  sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager >&2 || true
  exit 1
fi

log "==> Staging API is healthy."
log "==> Frontend root: $FRONTEND_ROOT"
log "==> Backend service: $SERVICE_NAME"
log "==> Staging deploy completed for $DEPLOY_SHA"
