#!/usr/bin/env bash
# =============================================================================
# يُشغَّل بـ root عبر: sudo DEPLOY_SHA=<sha> bash deploy/ci-backend-start.sh
# يضمن: PM2 الصحيح + قراءة .env + منفذ صحيح + بناء نظيف
# =============================================================================
set -euo pipefail

PROD=/var/www/noorix/backend
SHA="${DEPLOY_SHA:-}"
PM2BIN="$(which pm2 2>/dev/null || echo /usr/local/bin/pm2)"

echo "==> user: $(whoami) | pm2: $PM2BIN | prod: $PROD"

echo "==> إيقاف جميع عمليات noorix القديمة"
"$PM2BIN" stop  noorix-backend 2>/dev/null || true
"$PM2BIN" delete noorix-backend 2>/dev/null || true
"$PM2BIN" stop  noorix-api     2>/dev/null || true
"$PM2BIN" delete noorix-api     2>/dev/null || true
sleep 3

cd "$PROD"

echo "==> npm ci (نظيف)"
rm -rf node_modules
npm ci

echo "==> prisma generate"
npx prisma generate \
  || (sleep 5; npx prisma generate) \
  || (sleep 5; npx prisma generate)

echo "==> prisma migrate"
bash ../deploy/prisma-migrate-deploy-with-recovery.sh \
  || echo "WARN: prisma migrate فشل — نكمل لتجنب downtime"

echo "==> npm run build"
npm run build

echo "==> pm2 start (PORT من .env)"
DEPLOY_SHA="$SHA" "$PM2BIN" start ecosystem.config.cjs
"$PM2BIN" save --force

echo "==> قائمة العمليات:"
"$PM2BIN" list
