#!/usr/bin/env bash
# يُنفَّذ على الـ VPS عبر SSH من GitHub Actions — لا يعتمد على appleboy.
# المتغير DEPLOY_SHA يجب أن يُصدَر من الوكيل قبل bash -s (نفس github.sha).
set -e
: "${DEPLOY_SHA:?DEPLOY_SHA is required}"

echo "==> Deploy host: $(hostname) user: $(whoami)"
if ! sudo -n true 2>/dev/null; then
  echo "ERROR: مستخدم النشر يحتاج sudo بدون كلمة مرور (Defaults !requiretty + NOPASSWD لأوامر النشر)، أو شغّل الـ deploy بمستخدم لديه ذلك."
  exit 1
fi
if [ ! -f /tmp/noorix-frontend.tar.gz ]; then
  echo "ERROR: /tmp/noorix-frontend.tar.gz missing — SCP step did not upload the frontend archive."
  exit 1
fi
file /tmp/noorix-frontend.tar.gz || true
tar tzf /tmp/noorix-frontend.tar.gz >/dev/null
if [ ! -d /var/www/noorix ]; then
  echo "ERROR: /var/www/noorix not found. Clone the repo there and set up .env, or set NOORIX_ROOT on the server."
  exit 1
fi
cd /var/www/noorix
git fetch origin main
if git rev-parse --verify main >/dev/null 2>&1; then
  git checkout -f main
else
  git checkout -b main origin/main
fi
git reset --hard origin/main
echo "Deployed commit: $(git log -1 --oneline)"
sudo bash deploy/install-frontend.sh /tmp/noorix-frontend.tar.gz "$DEPLOY_SHA"
# لا تحذف الأرشيف هنا — عند فشل npm/migrate وإعادة محاولة SSH من CI يحتاج الملف ليبقى في /tmp
echo "==> المساحة (اختياري للتشخيص):" && df -h / /var/www 2>/dev/null | head -5 || true
echo "==> إيقاف noorix-backend مؤقتاً قبل npm ci"
pm2 stop noorix-backend 2>/dev/null || true
sleep 4
(cd backend && \
  rm -rf node_modules && \
  npm ci && \
  (npx prisma generate || (echo "==> إعادة prisma generate" >&2; sleep 5; npx prisma generate) || (echo "==> آخر محاولة prisma generate" >&2; sleep 5; npx prisma generate)) && \
  npx prisma migrate deploy && \
  npm run build)
(cd backend && pm2 startOrReload ecosystem.config.cjs --update-env)
API_PORT=3000
if [ -f backend/.env ]; then
  p=$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' backend/.env | head -1 | tr -d '\r')
  p=$(echo "$p" | sed "s/^[\"']//;s/[\"']$//" | tr -d '[:space:]')
  case "$p" in
    ''|*[!0-9]*) ;;
    *) API_PORT=$p ;;
  esac
fi
echo "==> فحوص liveness تستخدم منفذ API_PORT=${API_PORT} (نفس Nginx ‎proxy_pass)"
if [ "$API_PORT" != "3000" ]; then
  echo "   تنبيه: Nginx يجب أن يوجّه لـ 127.0.0.1:${API_PORT} وليس 3000 إن كان .env 8080"
fi
echo "==> انتظار liveness على 127.0.0.1:${API_PORT} (حتى 90s)"
ready=0
for i in $(seq 1 90); do
  if curl -sS -f -o /dev/null --connect-timeout 2 --max-time 3 "http://127.0.0.1:${API_PORT}/api/v1/health/live" 2>/dev/null; then
    echo "==> الـ API ردّ بعد ${i} ث"
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "ERROR: انتهت مهلة 90s — pm2 noorix-backend (آخر 80 سطر)" >&2
  pm2 logs noorix-backend --lines 80 --nostream 2>&1 | tail -80
  exit 1
fi
pm2 restart hajri-menu --update-env 2>/dev/null || true
echo "==> readiness (200 + status=ok | 503 إذا DB غير جاهز)"
curl -sS -f -o /tmp/noorix-h.txt --max-time 25 "http://127.0.0.1:${API_PORT}/api/v1/health"
head -c 500 /tmp/noorix-h.txt
echo ""
rm -f /tmp/noorix-h.txt
sudo systemctl reload nginx
echo "==> فحص Nginx: ملف مفقود تحت /assets/ يجب ألا يعيد index.html (انظر deploy/nginx-frontend-cache.example — location ^~ /assets/)"
curl -sSI --max-time 12 "https://hajrix.com/assets/.noorix-probe-missing.js" | head -18 || true
echo "==> فحص عبر https://hajrix.com (Nginx + TLS + تطبيق). إن فشل: فحص hairpin أو إعدادات النطاق"
curl -sS -f -o /tmp/noorix-pub.txt --max-time 35 "https://hajrix.com/api/v1/health"
head -c 500 /tmp/noorix-pub.txt
echo ""
rm -f /tmp/noorix-pub.txt
rm -f /tmp/noorix-frontend.tar.gz
echo "Deployment completed successfully!"
