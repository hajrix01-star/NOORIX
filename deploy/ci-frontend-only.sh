#!/usr/bin/env bash
# نشر الواجهة فقط عبر SSH — بدون إعادة بناء الـ backend (أسرع لتحديثات JS/CSS).
set -euo pipefail
: "${DEPLOY_SHA:?DEPLOY_SHA is required}"

echo "==> Deploy host: $(hostname) user: $(whoami)"
if ! sudo -n true 2>/dev/null; then
  echo "ERROR: مستخدم النشر يحتاج sudo بدون كلمة مرور."
  exit 1
fi
if [[ ! -f /tmp/noorix-frontend.tar.gz ]]; then
  echo "ERROR: /tmp/noorix-frontend.tar.gz missing"
  exit 1
fi
tar tzf /tmp/noorix-frontend.tar.gz >/dev/null

if [[ ! -d /var/www/noorix/deploy ]]; then
  echo "ERROR: /var/www/noorix/deploy not found"
  exit 1
fi
cd /var/www/noorix

sudo bash deploy/install-frontend.sh /tmp/noorix-frontend.tar.gz "$DEPLOY_SHA"
sudo systemctl reload nginx

echo "==> Frontend-only deploy OK — commit $DEPLOY_SHA"
curl -sS --max-time 20 "https://hajrix.com/" | grep -o 'noorix-build" content="[^"]*"' | head -1 || true
rm -f /tmp/noorix-frontend.tar.gz
