#!/usr/bin/env bash
# Runs Prisma migrations in fail-closed mode.
#
# Never mark a migration as applied from an error message. PostgreSQL can leave a
# partially-created schema behind after a failed migration, so schema drift must
# be repaired by an explicit, idempotent migration committed to the repository.
set -euo pipefail

LEGACY_RETIREMENT_MIGRATION="20260803180000_retire_legacy_orders"
ADVANCE_RECLASSIFICATION_MIGRATION="20260809010000_reclassify_employee_advances_as_assets"
PAYROLL_COST_GAP_MIGRATION="20260811123000_reconcile_historical_payroll_cost_gap"
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

# This migration was introduced with an invalid PostgreSQL UPDATE ... FROM
# reference and PostgreSQL rolled the transaction back. We only resolve that
# known failed attempt after proving that it left no account or ledger effects.
# Any non-zero artifact count is treated as possible drift and fails closed.
failed_advance_reclassification="$(psql --dbname="$DATABASE_URL" -Atqc "
  SELECT count(*)
  FROM \"_prisma_migrations\"
  WHERE migration_name = '${ADVANCE_RECLASSIFICATION_MIGRATION}'
    AND finished_at IS NULL
    AND rolled_back_at IS NULL
")"

if [[ "$failed_advance_reclassification" != "0" ]]; then
  advance_artifacts="$(psql --dbname="$DATABASE_URL" -Atqc "
    SELECT
      (SELECT count(*) FROM \"accounts\" WHERE code = 'ADV-001')
      +
      (SELECT count(*) FROM \"ledger_entries\" WHERE reference_type = 'advance_settlement')
  ")"
  if [[ "$advance_artifacts" != "0" ]]; then
    echo "ERROR: failed employee-advance reclassification left accounting artifacts; manual recovery is required" >&2
    exit 1
  fi
  echo "==> [prisma] verified rollback of the known employee-advance migration; marking attempt rolled back"
  npx prisma migrate resolve --rolled-back "$ADVANCE_RECLASSIFICATION_MIGRATION"
fi

# The first payroll cost-gap attempt used ON COMMIT DROP temporary tables
# without an explicit transaction. PostgreSQL therefore dropped the first
# table before the following statement. Recover only that exact known failure,
# and only when no migration-specific audit artifact exists.
failed_payroll_cost_gap="$(psql --dbname="$DATABASE_URL" -Atqc "
  SELECT count(*)
  FROM \"_prisma_migrations\"
  WHERE migration_name = '${PAYROLL_COST_GAP_MIGRATION}'
    AND finished_at IS NULL
    AND rolled_back_at IS NULL
    AND POSITION('_payroll_cost_gap_paid_runs' IN COALESCE(logs, '')) > 0
")"

if [[ "$failed_payroll_cost_gap" != "0" ]]; then
  payroll_cost_gap_artifacts="$(psql --dbname="$DATABASE_URL" -Atqc "
    SELECT count(*)
    FROM \"audit_logs\"
    WHERE entity = 'payroll_cost_gap'
      AND user_agent = 'prisma-migration'
  ")"
  if [[ "$payroll_cost_gap_artifacts" != "0" ]]; then
    echo "ERROR: failed payroll cost-gap migration left accounting artifacts; manual recovery is required" >&2
    exit 1
  fi
  echo "==> [prisma] verified the known temp-table failure; marking payroll cost-gap attempt rolled back"
  npx prisma migrate resolve --rolled-back "$PAYROLL_COST_GAP_MIGRATION"
fi
echo "==> [prisma] migrate deploy (strict)"
npx prisma migrate deploy
echo "==> [prisma] migrate deploy succeeded"
