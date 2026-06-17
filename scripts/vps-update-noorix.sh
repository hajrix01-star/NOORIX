#!/usr/bin/env bash
# تشغيله على السيرفر (مثلاً من /var/www/noorix): bash scripts/vps-update-noorix.sh
# يحدّث الكود، يطبّق migrations، يبني الـ backend والواجهة، ويعيد تشغيل PM2.
#
# الواجهة للزوار تُخدم من مجلد واحد (انظر deploy/install-frontend.sh): /etc/noorix/frontend-root أو الافتراضي /var/www/noorix/dist
# لا يكفي بناء dist/ داخل المستودع — يجب نسخه لنفس مجلد Nginx كما في GitHub Actions.
set -euo pipefail
ROOT="${NOORIX_ROOT:-/var/www/noorix}"
cd "$ROOT"
git pull origin main
(
  cd backend
  rm -rf node_modules
  npm ci
  npx prisma generate
  npx prisma migrate deploy
  npm run build
)
rm -rf node_modules
npm ci
SHA="$(git rev-parse HEAD)"
export VITE_BUILD_ID="$SHA"
npm run build
MANUAL_TAR="/tmp/noorix-frontend-manual.tar.gz"
tar czf "$MANUAL_TAR" -C dist .
if command -v sudo >/dev/null 2>&1; then
  sudo bash deploy/install-frontend.sh "$MANUAL_TAR" "$SHA"
else
  bash deploy/install-frontend.sh "$MANUAL_TAR" "$SHA"
fi
rm -f "$MANUAL_TAR"
# API عبر systemd (المسار الرسمي في deploy.yml) — تجنّب PM2 مكرر يتعارض مع الخدمة
if systemctl list-unit-files noorix-backend.service --no-pager 2>/dev/null | grep -q noorix-backend; then
  sudo bash deploy/install-noorix-backend-systemd.sh
else
  (cd backend && pm2 startOrReload ecosystem.config.cjs --update-env)
fi
# تطبيق منفصل (قائمة طعام/خدمة جانبية) — ليس نفس حزمة SPA الرئيسية
pm2 restart hajri-menu --update-env 2>/dev/null || true
