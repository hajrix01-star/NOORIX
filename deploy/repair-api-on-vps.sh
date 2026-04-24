#!/usr/bin/env bash
# =============================================================================
# إصلاح سريع للـ API على الـ VPS (مستودع في /var/www/noorix)
# ينبغي تشغيله بـ:  bash deploy/repair-api-on-vps.sh
# (من المستودع: cd /var/www/noorix && bash deploy/repair-api-on-vps.sh)
#
# يعيد build خفيف، prisma migrate، pm2 startOrReload، ويختبر health محلياً.
# إذا نجح curl لـ 127.0.0.1:3000 لكن hajrix.com ما زال 502 → راجع Nginx
#   (راجع: deploy/nginx-api-proxy.example)
# =============================================================================
set -euo pipefail

REPO="${NOORIX_ROOT:-/var/www/noorix}"
cd "$REPO"

echo "==> REPO: $REPO  commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

if [[ ! -f "$REPO/backend/package.json" ]]; then
  echo "ERROR: لا يوجد backend في $REPO" >&2
  exit 1
fi

cd "$REPO/backend"
echo "==> إيقاف noorix-backend (تحرير engines Prisma) ثم بيئة نظيفة"
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop noorix-backend 2>/dev/null || true
  sleep 4
fi
rm -rf node_modules
echo "==> npm ci + build"
npm ci
( npx prisma generate || ( sleep 5; npx prisma generate ) || ( sleep 5; npx prisma generate ) )
npx prisma migrate deploy
npm run build

echo "==> PM2 startOrReload (noorix-backend)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.cjs --update-env
  pm2 save
  pm2 list | head -20
else
  echo "ERROR: pm2 غير مثبت" >&2
  exit 1
fi

echo "==> liveness ثم readiness محلياً (بدون Nginx)"
if command -v curl >/dev/null 2>&1; then
  curl -sS -f -o /dev/null --max-time 12 "http://127.0.0.1:3000/api/v1/health/live" || { echo "FAIL liveness" >&2; exit 1; }
  if curl -sS -f -o /tmp/noorix-health.txt --max-time 20 "http://127.0.0.1:3000/api/v1/health"; then
    echo "OK readiness — http://127.0.0.1:3000/api/v1/health"
    head -c 500 /tmp/noorix-health.txt
    echo ""
  else
    echo "FAIL readiness (503=DB/تبعية). راجع: pm2 logs noorix-backend" >&2
    exit 1
  fi
  rm -f /tmp/noorix-health.txt
  if curl -sS -f -o /tmp/noorix-pub.txt --max-time 30 "https://hajrix.com/api/v1/health" 2>/dev/null; then
    echo "OK — عبر النطاق العام (Nginx+TLS):"
    head -c 400 /tmp/noorix-pub.txt
    echo ""
  else
    echo "تنبيه: النطاق العام لم يرد — إن كان المحلي ناجحاً راجع Nginx (انظر deploy/nginx-api-proxy.example)"
  fi
  rm -f /tmp/noorix-pub.txt
else
  echo "تحذير: curl غير متوفر"
fi

if command -v nginx >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null; then
    echo "==> اختبار إعداد Nginx (يعرض أخطاء التكوين إن وُجدت)"
    sudo nginx -t && sudo systemctl reload nginx
    echo "Nginx: reload done"
  else
    echo "لإعادة تحميل Nginx: sudo nginx -t && sudo systemctl reload nginx"
  fi
fi

echo "==> إن كان الموقع العام ما زال 502 بينما health المحلي ناجح: عدّل proxy_pass (انظر deploy/nginx-api-proxy.example)"
