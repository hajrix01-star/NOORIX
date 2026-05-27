#!/usr/bin/env bash
# إعادة تشغيل API بعد النشر — يفضّل خدمة systemd الدائمة (انظر restart-api-production.sh)
set -euo pipefail
REPO="${NOORIX_ROOT:-/var/www/noorix}"
export DEPLOY_SHA="${DEPLOY_SHA:-}"
exec bash "$REPO/deploy/restart-api-production.sh" "$@"
