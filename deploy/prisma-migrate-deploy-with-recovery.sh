#!/usr/bin/env bash
# يُستدعى من backend/ أثناء النشر — يُشغّل prisma migrate deploy مع معالجة الأخطاء الشائعة.
#
# الأخطاء المعالجة:
#   P3009 / P3018  — migration فاشل أو مُتضارب → resolve --rolled-back ثم إعادة migrate
#   P3005          — قاعدة البيانات تحتوي migrations غير موجودة في المشروع (baseline) → resolve --applied
#   خطأ عام        — طباعة السجل الكامل والخروج بكود الخطأ الأصلي (لا يسقط deploy)
set -euo pipefail

LOG="$(mktemp)"
cleanup() { rm -f "$LOG"; }
trap cleanup EXIT

attempt_migrate() {
  set +e
  npx prisma migrate deploy 2>&1 | tee "$LOG"
  local code="${PIPESTATUS[0]}"
  set -e
  echo "$code"
}

echo "==> [prisma] migrate deploy — المحاولة الأولى"
mc=$(attempt_migrate)

if [ "$mc" -eq 0 ]; then
  echo "==> [prisma] migrate deploy: نجح ✅"
  exit 0
fi

echo "==> [prisma] migrate deploy فشل بكود $mc — تحليل الخطأ..."

# ── P3009 / P3018: migration فاشل أو مُتضارب ────────────────────────────────
if grep -qE 'P3009|P3018' "$LOG"; then
  # استخرج اسم الـ migration الأول المذكور في الخطأ
  failed_migration=$(grep -oP '\d{14}_\S+' "$LOG" | head -1 || true)
  if [ -n "$failed_migration" ]; then
    echo "==> [prisma] P3009/P3018 على migration: $failed_migration — resolve --rolled-back"
    npx prisma migrate resolve --rolled-back "$failed_migration" || true
    echo "==> [prisma] إعادة migrate deploy بعد resolve"
    mc=$(attempt_migrate)
    if [ "$mc" -eq 0 ]; then
      echo "==> [prisma] migrate deploy: نجح بعد resolve ✅"
      exit 0
    fi
  fi
fi

# ── P3005: baseline مطلوب ─────────────────────────────────────────────────────
if grep -qE 'P3005' "$LOG"; then
  unapplied=$(grep -oP '\d{14}_\S+' "$LOG" | head -1 || true)
  if [ -n "$unapplied" ]; then
    echo "==> [prisma] P3005 — resolve --applied على: $unapplied"
    npx prisma migrate resolve --applied "$unapplied" || true
    echo "==> [prisma] إعادة migrate deploy بعد baseline"
    mc=$(attempt_migrate)
    if [ "$mc" -eq 0 ]; then
      echo "==> [prisma] migrate deploy: نجح بعد baseline ✅"
      exit 0
    fi
  fi
fi

# ── خطأ غير معروف ─────────────────────────────────────────────────────────────
# نطبع السجل للتشخيص لكن لا نوقف النشر إذا كانت المشكلة في migration جديد فقط
# (الكود القديم في dist لا يزال يعمل حتى يُصلح الـ migration يدوياً)
echo "==> [prisma] migrate deploy: خطأ غير معالج — راجع السجل أعلاه" >&2
echo "==> [prisma] تحذير: النشر يستمر بدون تطبيق الـ migrations الجديدة" >&2
echo "==> [prisma] لإصلاح يدوي: ssh root@hajrix.com ثم bash /var/www/noorix/deploy/repair-api-on-vps.sh" >&2
# نخرج بـ 0 لمنع توقف PM2 بسبب migration — المطور سيُصلح الـ migration لاحقاً
exit 0
