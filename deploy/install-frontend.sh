#!/usr/bin/env bash
# =============================================================================
# Noorix — نشر الواجهة الثابتة (dist) إلى مسار واحد معرّف على السيرفر
# =============================================================================
# يُفضّل تشغيله كـ root:  sudo bash deploy/install-frontend.sh <tarball> <git_sha>
# (يتجنب مشاكل sudo/requiretty في جلسات SSH غير التفاعلية من GitHub Actions.)
#
# مصدر واحد لمسار الواجهة: NOORIX_FRONTEND_ROOT → /etc/noorix/frontend-root → الافتراضي /var/www/noorix/dist
# (على الإنتاج الحالي: Nginx يضع root /var/www/noorix/dist لـ hajrix.com — يجب أن يطابق هذا الملف.)
# إعداد لمرة واحدة إذا كان root في Nginx مختلفاً:
#   sudo mkdir -p /etc/noorix && printf '%s\n' /المسار/الفعلي | sudo tee /etc/noorix/frontend-root
# =============================================================================
set -euo pipefail

TARBALL="${1:-}"
EXPECTED_SHA="${2:-}"

log() { printf '%s\n' "$*"; }

is_root() { [[ ${EUID:-$(id -u)} -eq 0 ]]; }

# أوامر تحتاج صلاحيات الكتابة على مجلد الويب: كـ root مباشرة، أو sudo -n (للجلسات غير التفاعلية)
srun() {
  if is_root; then
    "$@"
  elif /usr/bin/sudo -n "$@"; then
    :
  else
    log "ERROR: فشل تنفيذ (تحتاج sudo بدون TTY/كلمة مرور أو تشغيل السكربت كـ root): $*" >&2
    exit 1
  fi
}

if [[ -z "$TARBALL" || ! -f "$TARBALL" ]]; then
  log "ERROR: tarball غير موجود: ${TARBALL:-<empty>}" >&2
  exit 1
fi
if [[ -z "$EXPECTED_SHA" ]]; then
  log "ERROR: مطلوب SHA الـ commit كوسيط ثانٍ" >&2
  exit 1
fi

if ! tar tzf "$TARBALL" >/dev/null 2>&1; then
  log "ERROR: الملف ليس أرشيف gzip صالحاً: $TARBALL" >&2
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
  printf '%s' '/var/www/noorix/dist'
}

ROOT="$(resolve_frontend_root)"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

log "==> مسار الواجهة: $ROOT"
log "==> حجم الأرشيف: $(wc -c <"$TARBALL") بايت"

tar xzf "$TARBALL" -C "$TMP"

if [[ ! -d "$ROOT" ]]; then
  log "==> إنشاء المجلد: $ROOT"
  srun mkdir -p "$ROOT"
fi

if id www-data &>/dev/null; then
  srun rsync -a --delete --chown=www-data:www-data "${TMP}/" "${ROOT}/"
else
  srun rsync -a --delete "${TMP}/" "${ROOT}/"
fi

INDEX="${ROOT}/index.html"
if [[ ! -f "$INDEX" ]]; then
  log "ERROR: لا يوجد $INDEX بعد rsync" >&2
  exit 1
fi

if ! grep -qF "$EXPECTED_SHA" "$INDEX"; then
  log "ERROR: $INDEX لا يحتوي SHA المتوقع ($EXPECTED_SHA)." >&2
  log "--- تشخيص (لا يغيّر أي إعداد) ---" >&2
  if grep -q 'noorix-build' "$INDEX" 2>/dev/null; then
    log "وسم noorix-build الموجود:" >&2
    grep 'noorix-build' "$INDEX" | head -3 >&2 || true
  else
    log "لا يوجد وسم noorix-build في index — قد يكون المسار خطأ أو الأرشيف قديماً." >&2
  fi
  log "stat index.html:" >&2
  stat "$INDEX" >&2 || true
  log "أمثلة أسطر root في Nginx (راجع يدوياً أيها يخص الموقع):" >&2
  grep -hE '^\s*root\s+' /etc/nginx/sites-enabled/* 2>/dev/null | head -8 >&2 || log "(لا يمكن قراءة sites-enabled)" >&2
  log "إذا كان root مختلفاً: echo /المسار | sudo tee /etc/noorix/frontend-root" >&2
  exit 1
fi

log "==> التحقق من وجود ملفات /assets/ المذكورة في index.html"
missing_assets=0
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  if [[ ! -f "${ROOT}${rel}" ]]; then
    log "ERROR: مفقود (مذكور في index لكن غير موجود على القرص): ${ROOT}${rel}" >&2
    missing_assets=1
  fi
done < <(grep -oE '/assets/[A-Za-z0-9._-]+' "$INDEX" | sort -u)
if [[ "$missing_assets" -ne 0 ]]; then
  log "ERROR: أرشيف الواجهة ناقص أو ROOT غير صحيح — راجع tar ومسار Nginx." >&2
  exit 1
fi

log "==> تم التحقق: الواجهة في $ROOT تطابق commit $EXPECTED_SHA"
