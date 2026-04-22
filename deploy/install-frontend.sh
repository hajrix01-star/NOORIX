#!/usr/bin/env bash
# =============================================================================
# Noorix — نشر الواجهة الثابتة (dist) إلى مسار واحد معرّف صراحة على السيرفر
# =============================================================================
# لا يمس قواعد البيانات ولا مجلد الباكند؛ يحدّث فقط ملفات HTML/JS/CSS في مجلد الويب.
#
# الاستخدام (من السيرفر):
#   sudo bash deploy/install-frontend.sh /tmp/noorix-frontend.tar.gz <git_sha>
#
# مصدر واحد لمسار الواجهة (بالترتيب):
#   1) متغير البيئة NOORIX_FRONTEND_ROOT (اختياري؛ مفيد في سكربتات systemd فقط)
#   2) ملف /etc/noorix/frontend-root — سطر واحد: المسار المطلق لمجلد الواجهة (بدون شرطة نهائية)
#   3) الافتراضي: /var/www/hajrix.com
#
# إعداد لمرة واحدة إذا كان Nginx يشير لمجلد آخر (استبدل المسار بما في إعداد root):
#   sudo mkdir -p /etc/noorix
#   printf '%s\n' /var/www/html | sudo tee /etc/noorix/frontend-root
#   sudo chmod 644 /etc/noorix/frontend-root
#
# يجب أن يطابق هذا المسار قيمة root في Nginx لنفس الموقع.
# =============================================================================
set -euo pipefail

TARBALL="${1:-}"
EXPECTED_SHA="${2:-}"

if [[ -z "$TARBALL" || ! -f "$TARBALL" ]]; then
  echo "ERROR: tarball غير موجود: ${TARBALL:-<empty>}" >&2
  exit 1
fi
if [[ -z "$EXPECTED_SHA" ]]; then
  echo "ERROR: مطلوب SHA الـ commit الثاني للتحقق من index.html" >&2
  exit 1
fi

resolve_frontend_root() {
  if [[ -n "${NOORIX_FRONTEND_ROOT:-}" ]]; then
    printf '%s' "${NOORIX_FRONTEND_ROOT%/}"
    return
  fi
  if [[ -f /etc/noorix/frontend-root ]]; then
    local line
    line="$(head -n 1 /etc/noorix/frontend-root | tr -d '\r\n' | sed 's/[[:space:]]*$//;s/^[[:space:]]*//')"
    if [[ -n "$line" ]]; then
      printf '%s' "${line%/}"
      return
    fi
  fi
  printf '%s' '/var/www/hajrix.com'
}

ROOT="$(resolve_frontend_root)"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "==> مسار الواجهة (مصدر واحد): $ROOT"

tar xzf "$TARBALL" -C "$TMP"

if [[ ! -d "$ROOT" ]]; then
  echo "==> إنشاء المجلد: $ROOT"
  sudo mkdir -p "$ROOT"
fi

# دائماً عبر sudo: صلاحيات صحيحة لـ Nginx (www-data) بغضّ النظر عن مستخدم الـ deploy
if id www-data &>/dev/null; then
  sudo rsync -a --delete --chown=www-data:www-data "${TMP}/" "${ROOT}/"
else
  sudo rsync -a --delete "${TMP}/" "${ROOT}/"
fi

INDEX="${ROOT}/index.html"
if [[ ! -f "$INDEX" ]]; then
  echo "ERROR: بعد النشر لا يوجد $INDEX" >&2
  exit 1
fi
if ! grep -qF "$EXPECTED_SHA" "$INDEX"; then
  echo "ERROR: $INDEX لا يحتوي على معرّف البناء $EXPECTED_SHA (تحقق من تطابق المسار مع root في Nginx)" >&2
  exit 1
fi

echo "==> تم التحقق: الواجهة في $ROOT تطابق commit $EXPECTED_SHA"
