#!/usr/bin/env bash
# Runs Prisma migrations in fail-closed mode.
#
# Never mark a migration as applied from an error message. PostgreSQL can leave a
# partially-created schema behind after a failed migration, so schema drift must
# be repaired by an explicit, idempotent migration committed to the repository.
set -euo pipefail

LEGACY_RETIREMENT_MIGRATION="20260803180000_retire_legacy_orders"
LEGACY_TABLES=(
  order_categories order_sections order_catalog_units order_conversion_templates
  order_products orders order_items staff_orders staff_order_items
  inventory_stocktakes inventory_stocktake_lines inventory_movements
  inventory_locations_v2 inventory_definition_versions_v2 inventory_ledger_entries_v2
  shisha_inventory_settings shisha_inventory_movements shisha_stocktakes
)

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(node -e "require('dotenv').config({path:'.env',quiet:true}); process.stdout.write(process.env.DATABASE_URL || '')")"
fi
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is unavailable; refusing migration recovery" >&2
  exit 1
fi

failed_retirement="$(psql --dbname="$DATABASE_URL" -Atqc "
  SELECT count(*)
  FROM \"_prisma_migrations\"
  WHERE migration_name = '${LEGACY_RETIREMENT_MIGRATION}'
    AND finished_at IS NULL
    AND rolled_back_at IS NULL
")"

if [[ "$failed_retirement" != "0" ]]; then
  table_literals=""
  for table in "${LEGACY_TABLES[@]}"; do
    [[ -n "$table_literals" ]] && table_literals+=","
    table_literals+="'${table}'"
  done
  legacy_table_count="$(psql --dbname="$DATABASE_URL" -Atqc "
    SELECT count(*) FROM unnest(ARRAY[${table_literals}]) AS table_name
    WHERE to_regclass('public.' || table_name) IS NOT NULL
  ")"
  archive_table_exists="$(psql --dbname="$DATABASE_URL" -Atqc "
    SELECT CASE WHEN to_regclass('public.orders_v4_legacy_archives') IS NULL THEN 0 ELSE 1 END
  ")"
  if [[ "$legacy_table_count" != "${#LEGACY_TABLES[@]}" || "$archive_table_exists" != "0" ]]; then
    echo "ERROR: failed retirement migration left an unexpected partial schema; manual recovery is required" >&2
    exit 1
  fi
  echo "==> [prisma] verified transactional rollback; marking the known retirement attempt rolled back"
  npx prisma migrate resolve --rolled-back "$LEGACY_RETIREMENT_MIGRATION"
fi

echo "==> [prisma] migrate deploy (strict)"
npx prisma migrate deploy
echo "==> [prisma] migrate deploy succeeded"
