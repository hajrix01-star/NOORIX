#!/usr/bin/env bash
# =============================================================================
# تشغيله على الـ VPS (بعد SSH)، من مجلد المستودع أو أي مسار:
#   bash /var/www/noorix/deploy/verify-frontend-on-server.sh
#
# يطبع تشخيصاً واحداً: أين مجلد الواجهة، ما commit المستودع، ما في index.html
# الذي يُخدم فعلياً، ومقارنة مع dist داخل المستودع إن وُجد.
# لا يغيّر أي شيء (قراءة فقط).
# =============================================================================
set -u

REPO="${NOORIX_ROOT:-/var/www/noorix}"

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

section() { printf '\n=== %s ===\n' "$*"; }

section "مسار الواجهة (نفس منطق النشر)"
ROOT="$(resolve_frontend_root)"
printf 'NOORIX_FRONTEND_ROOT (env): %s\n' "${NOORIX_FRONTEND_ROOT:-<غير مضبوط>}"
if [[ -f /etc/noorix/frontend-root ]]; then
  printf '/etc/noorix/frontend-root:\n%s\n' "$(cat /etc/noorix/frontend-root)"
else
  printf '/etc/noorix/frontend-root: <غير موجود — يُستخدم الافتراضي>\n'
fi
printf 'المجلد المستخدم للتحقق: %s\n' "$ROOT"

section "المستودع على السيرفر"
if [[ ! -d "$REPO/.git" ]]; then
  printf 'تحذير: لا يوجد git في %s\n' "$REPO"
else
  (cd "$REPO" && printf 'الفرع: %s\n' "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ?)")
  (cd "$REPO" && printf 'HEAD المحلي: %s\n' "$(git rev-parse HEAD 2>/dev/null || echo ?)")
  (cd "$REPO" && git fetch origin main -q 2>/dev/null || true)
  (cd "$REPO" && printf 'origin/main: %s\n' "$(git rev-parse origin/main 2>/dev/null || echo ?)")
fi

INDEX="${ROOT}/index.html"
section "index.html الذي يجب أن يقرأه Nginx (مجلد الويب)"
if [[ ! -f "$INDEX" ]]; then
  printf '❌ لا يوجد الملف: %s\n' "$INDEX"
  printf '   → Nginx root غير مطابق لمسار النشر، أو المجلد فارغ.\n'
else
  stat "$INDEX" 2>/dev/null || ls -la "$INDEX"
  printf '\nوسم noorix-build (يجب أن يطابق آخر نشر من GitHub):\n'
  if grep -q 'noorix-build' "$INDEX" 2>/dev/null; then
    grep 'noorix-build' "$INDEX" | head -3
    META_SHA="$(sed -n 's/.*name="noorix-build" content="\([^"]*\)".*/\1/p' "$INDEX" | head -1)"
    printf '\nقيمة SHA من الملف: %s\n' "${META_SHA:-<فارغ>}"
    if [[ -d "$REPO/.git" ]]; then
      HEAD_SHA="$(cd "$REPO" && git rev-parse HEAD 2>/dev/null)"
      if [[ -n "$META_SHA" && -n "$HEAD_SHA" && "$META_SHA" == "$HEAD_SHA" ]]; then
        printf '✅ تطابق: وسم البناء = HEAD المستودع (واجهة حديثة لهذا الـ commit على السيرفر).\n'
      elif [[ -n "$META_SHA" && -n "$HEAD_SHA" ]]; then
        printf '⚠️  لا تطابق: الواجهة المنسوخة commit=%s بينما المستودع HEAD=%s\n' "$META_SHA" "$HEAD_SHA"
        printf '   → شغّل نشراً ناجحاً (GitHub Actions) أو: bash scripts/vps-update-noorix.sh\n'
      fi
    fi
  else
    printf '❌ لا يوجد وسم noorix-build — هذا build قديم (قبل إضافة الوسم) أو ملف ليس من Vite الحديث.\n'
  fi
fi

section "مقارنة: dist داخل المستودع (قد يكون محدثاً دون أن يُنسخ للويب)"
DIST_INDEX="${REPO}/dist/index.html"
if [[ -f "$DIST_INDEX" ]]; then
  stat "$DIST_INDEX" 2>/dev/null || true
  if grep -q 'noorix-build' "$DIST_INDEX" 2>/dev/null; then
    grep 'noorix-build' "$DIST_INDEX" | head -2
    printf '(إن كان مختلفاً عن مجلد الويب أعلاه → النشر لم يُنسخ dist إلى Nginx root)\n'
  else
    printf 'dist/index.html بدون noorix-build (لم يُبنَ بهذا المشروع بعد التحديث)\n'
  fi
else
  printf 'لا يوجد %s (طبيعي إذا البناء فقط على GitHub)\n' "$DIST_INDEX"
fi

section "لمحات من Nginx (اقرأ يدوياً أي server_name يخص hajrix)"
if [[ -d /etc/nginx/sites-enabled ]]; then
  grep -hE 'server_name|^\s*root\s+' /etc/nginx/sites-enabled/* 2>/dev/null | head -24 || printf 'لا يمكن القراءة\n'
else
  printf 'لا يوجد /etc/nginx/sites-enabled\n'
fi

section "اختبار HTTP محلي (إن وُجد curl)"
if command -v curl >/dev/null 2>&1; then
  curl -sI --max-time 8 "https://hajrix.com/" 2>/dev/null | grep -iE '^(HTTP/|last-modified|cache-control)' || printf 'تعذّر curl للنطاق العام (جدار/SSL)\n'
else
  printf 'curl غير مثبت\n'
fi

printf '\n--- انتهى التشخيص ---\n'
printf 'الواجهة «الحديثة» = index في %s يحتوي noorix-build ويفضّل أن يطابق git HEAD بعد آخر نشر.\n' "$ROOT"
printf 'تذكير: إن كان Nginx يعرّف root /var/www/noorix/dist لـ hajrix.com فهذا هو المسار الفعلي للزائر (وليس مجلداً آخر).\n'
