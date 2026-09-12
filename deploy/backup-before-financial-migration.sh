#!/usr/bin/env bash
# Full logical backup immediately before a financial data migration.
# The backup is verified before Prisma can write any ledger or payroll state.
set -euo pipefail

PROD_DIR="${1:-/var/www/noorix/backend}"
BACKUP_DIR="/var/backups/noorix/financial-migrations"

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(cd "$PROD_DIR" && node -e "require('dotenv').config({path:'.env',quiet:true}); process.stdout.write(process.env.DATABASE_URL || '')")"
fi
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is unavailable; refusing financial migration backup" >&2
  exit 1
fi

database_identity="$(node -e '
  const parsed = new URL(process.argv[1]);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  process.stdout.write(`${parsed.hostname}\t${database}`);
' "$DATABASE_URL")"
IFS=$'\t' read -r database_host database_name <<<"$database_identity"
if [[ ! "$database_host" =~ ^(localhost|127\.0\.0\.1|\[::1\])$ ]]; then
  echo "ERROR: financial migration backup requires a local production database" >&2
  exit 1
fi
if [[ ! "$database_name" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "ERROR: invalid production database name; refusing financial migration backup" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
sha="${GITHUB_SHA:-manual}"
tmp_dump="$(mktemp /tmp/noorix-financial-migration-XXXXXX.dump)"
tmp_sha="${tmp_dump}.sha256"
cleanup() { rm -f "$tmp_dump" "$tmp_sha"; }
trap cleanup EXIT

echo "==> Creating verified full logical backup before financial migration"
# Use the local PostgreSQL owner so RLS cannot produce a tenant-filtered backup.
sudo -u postgres pg_dump --dbname="$database_name" --format=custom --no-owner --no-privileges >"$tmp_dump"
pg_restore --list "$tmp_dump" >/dev/null
sha256sum "$tmp_dump" >"$tmp_sha"

sudo install -d -m 0700 "$BACKUP_DIR"
sudo install -m 0600 "$tmp_dump" "$BACKUP_DIR/financial-migration-${stamp}-${sha}.dump"
sudo install -m 0600 "$tmp_sha" "$BACKUP_DIR/financial-migration-${stamp}-${sha}.dump.sha256"
echo "==> Financial migration backup verified and stored locally"
