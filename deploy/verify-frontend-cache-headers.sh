#!/usr/bin/env bash
# =============================================================================
# تحقق من رؤوس كاش الواجهة على الإنتاج — يفشل النشر إذا الإعداد ناقص.
# الاستخدام: bash deploy/verify-frontend-cache-headers.sh [origin]
# =============================================================================
set -euo pipefail

ORIGIN="${1:-https://hajrix.com}"
ORIGIN="${ORIGIN%/}"

log() { printf '%s\n' "$*"; }
fail=0

require_header_pattern() {
  local path="$1"
  local pattern="$2"
  local label="$3"
  local hdr
  hdr="$(curl -sSI --max-time 20 "${ORIGIN}${path}" 2>/dev/null || true)"
  if echo "$hdr" | grep -qiE "$pattern"; then
    log "OK: ${label}"
    return 0
  fi
  log "FAIL: ${label} — لم يُعثر على Cache-Control المطلوب"
  echo "$hdr" | head -12
  fail=1
}

log "==> فحص كاش الواجهة على ${ORIGIN}"

require_header_pattern "/index.html" 'cache-control:.*(no-store|no-cache)' 'index.html'
require_header_pattern "/sw.js" 'cache-control:.*(no-store|no-cache)' 'sw.js'

probe_hdr="$(curl -sSI --max-time 20 "${ORIGIN}/assets/.noorix-probe-missing.js" 2>/dev/null || true)"
probe_code="$(printf '%s' "$probe_hdr" | head -1 | awk '{print $2}')"
probe_type="$(printf '%s' "$probe_hdr" | grep -i '^content-type:' | head -1 || true)"

if [[ "$probe_code" == "404" ]]; then
  log "OK: أصل /assets/ مفقود يعيد 404"
elif [[ "$probe_code" == "200" ]] && echo "$probe_type" | grep -qi 'text/html'; then
  log "FAIL: أصل /assets/ مفقود يعيد index.html (يسبب أخطاء chunk بعد النشر)"
  echo "$probe_hdr" | head -12
  fail=1
else
  log "WARN: سلوك /assets/ مفقود غير متوقع (code=${probe_code:-?}) — راجع Nginx"
fi

assets_hdr="$(curl -sSI --max-time 20 "${ORIGIN}/" 2>/dev/null | head -1 || true)"
# فحص asset حقيقي من index إن وُجد
index_html="$(curl -sS --max-time 20 "${ORIGIN}/" 2>/dev/null || true)"
asset_path="$(printf '%s' "$index_html" | grep -oE '/assets/[A-Za-z0-9._-]+\.js' | head -1 || true)"
if [[ -n "$asset_path" ]]; then
  if curl -sSI --max-time 20 "${ORIGIN}${asset_path}" 2>/dev/null | grep -qi 'cache-control:.*immutable'; then
    log "OK: ${asset_path} يحمل immutable"
  else
    log "WARN: ${asset_path} بدون immutable (مستحسن لكن ليس حرجاً)"
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  log ""
  log "للإصلاح على السيرفر: sudo bash deploy/install-nginx-frontend-cache.sh"
  exit 1
fi

log "==> فحص كاش الواجهة: نجاح"
