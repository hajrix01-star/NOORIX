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

for attempt in $(seq 1 100); do
  echo "==> [prisma] migrate deploy attempt $attempt"
  if attempt_migrate; then
    echo "==> [prisma] migrate deploy succeeded"
    exit 0
  fi

  echo "==> [prisma] migrate deploy failed; checking known recovery cases"
  failed_migration="$(first_migration_from_log)"
  if [ -z "$failed_migration" ]; then
    break
  fi

  if grep -q 'already exists' "$LOG"; then
    echo "==> [prisma] existing database object detected for $failed_migration"
    npx prisma migrate resolve --applied "$failed_migration"
    continue
  fi

  if grep -qE 'P3005' "$LOG"; then
    echo "==> [prisma] baseline required for $failed_migration"
    npx prisma migrate resolve --applied "$failed_migration"
    continue
  fi

  if grep -qE 'P3009|P3018' "$LOG"; then
    echo "==> [prisma] failed migration state detected for $failed_migration"
    npx prisma migrate resolve --rolled-back "$failed_migration" || true
    continue
  fi

  break
done

echo "==> [prisma] migrate deploy could not be recovered automatically" >&2
exit 1
