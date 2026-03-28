#!/usr/bin/env bash
# تشغيله على السيرفر (مثلاً من /var/www/noorix): bash scripts/vps-update-noorix.sh
# يحدّث الكود، يطبّق migrations، يبني الـ backend والواجهة، ويعيد تشغيل PM2.
set -euo pipefail
ROOT="${NOORIX_ROOT:-/var/www/noorix}"
cd "$ROOT"
git pull origin main
(
  cd backend
  npm ci
  npx prisma migrate deploy
  npm run build
)
npm ci
npm run build
# Noorix API: من مجلد backend الحقيقي (ليس /root/backend). احذف noorix-api القديمة من PM2 مرة واحدة إن وُجدت.
(cd backend && pm2 startOrReload ecosystem.config.cjs --update-env)
pm2 restart hajri-menu --update-env 2>/dev/null || true
