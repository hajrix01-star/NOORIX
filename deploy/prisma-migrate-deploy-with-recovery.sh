#!/usr/bin/env bash
# Runs Prisma migrations with a narrow recovery path for restored/staging databases.
set -euo pipefail

LOG="$(mktemp)"
cleanup() { rm -f "$LOG"; }
trap cleanup EXIT

attempt_migrate() {
  : >"$LOG"
  set +e
  npx prisma migrate deploy 2>&1 | tee "$LOG"
  local code="${PIPESTATUS[0]}"
  set -e
  return "$code"
}

first_migration_from_log() {
  grep -oE '[0-9]{14}_[A-Za-z0-9_-]+' "$LOG" | head -1 || true
}

retry_after_applied() {
  local migration="$1"
  echo "==> [prisma] marking migration as applied: $migration"
  npx prisma migrate resolve --applied "$migration"
  echo "==> [prisma] retrying migrate deploy"
  attempt_migrate
}

retry_after_rolled_back() {
  local migration="$1"
  echo "==> [prisma] rolling back failed migration state: $migration"
  npx prisma migrate resolve --rolled-back "$migration" || true
  echo "==> [prisma] retrying migrate deploy"
  attempt_migrate
}

echo "==> [prisma] migrate deploy"
if attempt_migrate; then
  echo "==> [prisma] migrate deploy succeeded"
  exit 0
fi

echo "==> [prisma] migrate deploy failed; checking known recovery cases"
failed_migration="$(first_migration_from_log)"

if grep -q 'already exists' "$LOG" && [ -n "$failed_migration" ]; then
  echo "==> [prisma] existing database object detected for $failed_migration"
  if retry_after_applied "$failed_migration"; then
    echo "==> [prisma] migrate deploy succeeded after applied resolve"
    exit 0
  fi
fi

if grep -qE 'P3005' "$LOG" && [ -n "$failed_migration" ]; then
  echo "==> [prisma] baseline required for $failed_migration"
  if retry_after_applied "$failed_migration"; then
    echo "==> [prisma] migrate deploy succeeded after baseline resolve"
    exit 0
  fi
fi

if grep -qE 'P3009|P3018' "$LOG" && [ -n "$failed_migration" ]; then
  echo "==> [prisma] failed migration state detected for $failed_migration"
  if retry_after_rolled_back "$failed_migration"; then
    echo "==> [prisma] migrate deploy succeeded after rollback resolve"
    exit 0
  fi
fi

echo "==> [prisma] migrate deploy could not be recovered automatically" >&2
exit 1
