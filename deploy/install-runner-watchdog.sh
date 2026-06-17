#!/usr/bin/env bash
# تثبيت مراقبة runner + ضمان swap + إعادة تشغيل تلقائي للخدمة.
set -euo pipefail

REPO="${NOORIX_ROOT:-/var/www/noorix}"
WATCHDOG="$REPO/deploy/runner-watchdog.sh"
CRON_LINE='*/5 * * * * root /bin/bash /var/www/noorix/deploy/runner-watchdog.sh >> /var/log/noorix-runner-watchdog.log 2>&1'

echo "==> Ensure 4G swap"
if ! swapon --show | grep -q .; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -w vm.swappiness=10 >/dev/null 2>&1 || true

echo "==> Runner service: Restart=always"
SERVICE="$(ls -1 /etc/systemd/system/actions.runner.*.service 2>/dev/null | head -1 || true)"
if [[ -n "$SERVICE" ]]; then
  UNIT="$(basename "$SERVICE")"
  mkdir -p "/etc/systemd/system/${UNIT}.d"
  cat > "/etc/systemd/system/${UNIT}.d/override.conf" <<'EOF'
[Service]
Restart=always
RestartSec=15
EOF
  systemctl daemon-reload
  systemctl enable "$UNIT" 2>/dev/null || true
  systemctl start "$UNIT" 2>/dev/null || true
fi

echo "==> Install cron watchdog (every 5 min)"
CRON_FILE=/etc/cron.d/noorix-runner-watchdog
echo "$CRON_LINE" > "$CRON_FILE"
chmod 644 "$CRON_FILE"
chmod 755 "$WATCHDOG"

echo "==> Done"
free -h | head -2
systemctl is-active "actions.runner.hajrix01-star-NOORIX.srv1522297.service" 2>/dev/null || systemctl list-units 'actions.runner.*' --no-pager 2>/dev/null | head -5
