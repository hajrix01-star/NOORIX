#!/usr/bin/env bash
set -euo pipefail

PROD_DIR="${1:-/var/www/noorix/backend}"
BACKUP_DIR="/var/backups/noorix/legacy-orders-retirement"
TABLES=(
  order_categories order_sections order_catalog_units order_conversion_templates
  order_products orders order_items staff_orders staff_order_items
  inventory_stocktakes inventory_stocktake_lines inventory_movements
  inventory_locations_v2 inventory_definition_versions_v2 inventory_ledger_entries_v2
  shisha_inventory_settings shisha_inventory_movements shisha_stocktakes
)

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(cd "$PROD_DIR" && node -e "require('dotenv').config({path:'.env',quiet:true}); process.stdout.write(process.env.DATABASE_URL || '')")"
fi
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is unavailable; refusing legacy Orders retirement" >&2
  exit 1
fi

database_identity="$(node -e '
  const parsed = new URL(process.argv[1]);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  process.stdout.write(`${parsed.hostname}\t${database}`);
' "$DATABASE_URL")"
IFS=$'\t' read -r database_host database_name <<<"$database_identity"
if [[ ! "$database_host" =~ ^(localhost|127\.0\.0\.1|\[::1\])$ ]]; then
  echo "ERROR: legacy Orders backup requires the production database to be local; refusing remote superuser access" >&2
  exit 1
fi
if [[ ! "$database_name" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "ERROR: invalid production database name; refusing legacy Orders retirement" >&2
  exit 1
fi

table_literals=""
for table in "${TABLES[@]}"; do
  [[ -n "$table_literals" ]] && table_literals+=","
  table_literals+="'${table}'"
done

existing_count="$(psql --dbname="$DATABASE_URL" -Atqc "SELECT count(*) FROM unnest(ARRAY[${table_literals}]) AS table_name WHERE to_regclass('public.' || table_name) IS NOT NULL")"
if [[ "$existing_count" == "0" ]]; then
  echo "==> Legacy Orders tables already retired; no retirement backup required"
  exit 0
fi
if [[ "$existing_count" != "${#TABLES[@]}" ]]; then
  echo "ERROR: only $existing_count/${#TABLES[@]} legacy Orders tables exist; refusing a partial retirement" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
sha="${GITHUB_SHA:-manual}"
tmp_dump="$(mktemp /tmp/noorix-legacy-orders-XXXXXX.dump)"
tmp_sha="${tmp_dump}.sha256"
cleanup() { rm -f "$tmp_dump" "$tmp_sha"; }
trap cleanup EXIT

args=()
for table in "${TABLES[@]}"; do args+=(--table="public.${table}"); done

echo "==> Creating immutable pre-retirement backup for ${#TABLES[@]} legacy Orders tables"
# These tables enforce RLS for the application role. The local PostgreSQL owner is
# required so the retirement backup contains every tenant, never a filtered subset.
sudo -u postgres pg_dump --dbname="$database_name" --format=custom --no-owner --no-privileges "${args[@]}" >"$tmp_dump"
pg_restore --list "$tmp_dump" >/dev/null
sha256sum "$tmp_dump" >"$tmp_sha"

sudo install -d -m 0700 "$BACKUP_DIR"
sudo install -m 0600 "$tmp_dump" "$BACKUP_DIR/legacy-orders-${stamp}-${sha}.dump"
sudo install -m 0600 "$tmp_sha" "$BACKUP_DIR/legacy-orders-${stamp}-${sha}.dump.sha256"
echo "==> Legacy Orders retirement backup verified and stored locally"
