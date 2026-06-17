#!/usr/bin/env bash
# مراقبة GitHub Actions runner — يعيد تشغيل الخدمة إن توقفت (مثلاً بعد oom-kill).
set -euo pipefail

RUNNER_DIR="${RUNNER_DIR:-/root/actions-runner}"
SERVICE_GLOB="/etc/systemd/system/actions.runner.*.service"

if ! compgen -G "$SERVICE_GLOB" >/dev/null 2>&1; then
  echo "runner-watchdog: no actions.runner systemd unit found — skip"
  exit 0
fi

SERVICE="$(basename "$(ls -1 $SERVICE_GLOB | head -1)" .service)"

if systemctl is-active --quiet "$SERVICE"; then
  echo "runner-watchdog: $SERVICE is active"
  exit 0
fi

echo "runner-watchdog: $SERVICE down — starting"
systemctl start "$SERVICE"
sleep 3
if systemctl is-active --quiet "$SERVICE"; then
  echo "runner-watchdog: $SERVICE recovered"
else
  echo "runner-watchdog: FAILED to start $SERVICE" >&2
  journalctl -u "$SERVICE" -n 20 --no-pager >&2 || true
  exit 1
fi
