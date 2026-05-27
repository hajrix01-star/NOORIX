#!/usr/bin/env bash
# إعادة تشغيل API في الإنتاج — يفضّل systemd الدائمة؛ fallback لـ detached PM2
set -euo pipefail

REPO="${NOORIX_ROOT:-/var/www/noorix}"
export DEPLOY_SHA="${DEPLOY_SHA:-}"

if systemctl list-unit-files noorix-backend.service 2>/dev/null | grep -q noorix-backend.service; then
  echo "==> systemctl restart noorix-backend"
  sudo systemctl restart noorix-backend.service
  if [[ "${1:-}" == "--wait-public" ]]; then
    bash "$REPO/deploy/wait-public-api.sh"
  fi
  exit 0
fi

echo "WARN: noorix-backend.service not installed — running install + detached fallback"
sudo bash "$REPO/deploy/install-noorix-backend-systemd.sh"
if [[ "${1:-}" == "--wait-public" ]]; then
  bash "$REPO/deploy/wait-public-api.sh"
fi
