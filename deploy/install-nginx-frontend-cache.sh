#!/usr/bin/env bash
# =============================================================================
# Noorix — تثبيت قواعد كاش Nginx للواجهة (مرة واحدة + تحديث عند تغيير الـ snippet)
# يُشغَّل على الـ VPS: sudo bash deploy/install-nginx-frontend-cache.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNIPPET_SRC="${SCRIPT_DIR}/nginx-frontend-cache.snippet.conf"
SNIPPET_DST="/etc/nginx/snippets/noorix-frontend-cache.conf"
INCLUDE_LINE='include /etc/nginx/snippets/noorix-frontend-cache.conf;'

log() { printf '%s\n' "$*"; }

is_root() { [[ ${EUID:-$(id -u)} -eq 0 ]]; }

srun() {
  if is_root; then
    "$@"
  elif /usr/bin/sudo -n "$@"; then
    :
  else
    log "ERROR: تحتاج sudo بدون TTY أو تشغيل السكربت كـ root: $*" >&2
    exit 1
  fi
}

if [[ ! -f "$SNIPPET_SRC" ]]; then
  log "ERROR: ملف الـ snippet غير موجود: $SNIPPET_SRC" >&2
  exit 1
fi

log "==> نسخ snippet إلى $SNIPPET_DST"
srun mkdir -p /etc/nginx/snippets
srun cp "$SNIPPET_SRC" "$SNIPPET_DST"

patched=0
shopt -s nullglob
for f in /etc/nginx/sites-enabled/*; do
  [[ -f "$f" ]] || continue
  if ! grep -qE 'server_name.*hajrix|/var/www/noorix/dist' "$f" 2>/dev/null; then
    continue
  fi
  if grep -qF "$INCLUDE_LINE" "$f" 2>/dev/null; then
    log "==> مضمّن مسبقاً: $f"
    patched=$((patched + 1))
    continue
  fi
  log "==> إضافة include إلى: $f"
  tmp="$(mktemp)"
  awk -v inc="    ${INCLUDE_LINE}" '
    /server_name/ && !done {
      print
      print inc
      done=1
      next
    }
    { print }
  ' "$f" > "$tmp"
  srun cp "$tmp" "$f"
  rm -f "$tmp"
  patched=$((patched + 1))
done

if [[ "$patched" -eq 0 ]]; then
  log "WARN: لم يُعثر على server block لـ hajrix — أضف يدوياً داخل server { }:" >&2
  log "    $INCLUDE_LINE" >&2
fi

log "==> nginx -t"
srun nginx -t

log "==> systemctl reload nginx"
srun systemctl reload nginx

log "==> تم تثبيت قواعد كاش الواجهة بنجاح"
