#!/usr/bin/env bash
# يُستدعى من backend/ أثناء النشر — يعالج P3009 للهجرة الفاشلة dedup_key مرة واحدة ثم يُعيد migrate deploy.
set -euo pipefail
LOG="$(mktemp)"
cleanup() { rm -f "$LOG"; }
trap cleanup EXIT

set +e
npx prisma migrate deploy 2>&1 | tee "$LOG"
mc="${PIPESTATUS[0]}"
set -e

if [ "$mc" -eq 0 ]; then
  exit 0
fi

if grep -q 'P3009' "$LOG" && grep -q '20260502150000_invoice_supplier_invoice_dedup_key' "$LOG"; then
  echo "==> [prisma] P3009 على هجرة supplier_invoice_dedup_key — migrate resolve --rolled-back ثم إعادة deploy"
  npx prisma migrate resolve --rolled-back "20260502150000_invoice_supplier_invoice_dedup_key"
  exec npx prisma migrate deploy
fi

echo "==> [prisma] migrate deploy فشل بدون حالة P3009 المعروفة — الخرج أعلاه" >&2
exit "$mc"
