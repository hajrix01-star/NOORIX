import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Run the inventory schema verifier from the backend directory with its .env available.',
  );
}

const requiredTables = [
  'orders_v4_units',
  'orders_v4_items',
  'orders_v4_item_units',
  'orders_v4_conversion_versions',
  'orders_v4_conversion_edges',
  'orders_v4_recipe_versions',
  'orders_v4_recipe_lines',
  'orders_v4_locations',
  'orders_v4_documents',
  'orders_v4_document_lines',
  'orders_v4_inventory_ledger',
  'orders_v4_stocktakes',
  'orders_v4_stocktake_lines',
  'orders_v4_legacy_archives',
];

const requiredColumns = [
  ['orders_v4_items', 'inventory_unit_id'],
  ['orders_v4_items', 'kernel_unit_id'],
  ['orders_v4_document_lines', 'base_quantity'],
  ['orders_v4_document_lines', 'base_unit_id'],
  ['orders_v4_document_lines', 'conversion_snapshot'],
  ['orders_v4_document_lines', 'recipe_snapshot'],
  ['orders_v4_document_lines', 'cost_snapshot'],
  ['orders_v4_inventory_ledger', 'quantity_delta'],
  ['orders_v4_inventory_ledger', 'average_unit_cost_after'],
  ['orders_v4_legacy_archives', 'source_checksum'],
];

const requiredConstraints = [
  'orders_v4_items_kernel_unit_id_fkey',
  'orders_v4_conversion_factor_check',
  'orders_v4_recipe_line_quantity_check',
  'orders_v4_document_line_quantity_check',
  'orders_v4_inventory_entry_type_check',
  'orders_v4_inventory_cost_check',
  'orders_v4_stocktake_status_check',
  'orders_v4_legacy_archives_company_id_fkey',
];

const requiredIndexes = [
  'orders_v4_units_company_id_code_key',
  'orders_v4_item_units_item_id_unit_id_key',
  'orders_v4_conversion_edges_version_id_from_unit_id_to_unit__key',
  'orders_v4_inventory_ledger_company_id_item_id_location_id_s_idx',
  'orders_v4_inventory_ledger_company_id_source_key_key',
  'orders_v4_stocktakes_company_id_stocktake_number_key',
  'orders_v4_stocktake_lines_stocktake_id_item_id_key',
  'orders_v4_legacy_archives_company_source_key',
];

const retiredTables = [
  'order_categories', 'order_sections', 'order_catalog_units', 'order_conversion_templates',
  'order_products', 'orders', 'order_items', 'staff_orders', 'staff_order_items',
  'inventory_stocktakes', 'inventory_stocktake_lines', 'inventory_movements',
  'inventory_locations_v2', 'inventory_definition_versions_v2', 'inventory_ledger_entries_v2',
  'shisha_inventory_settings', 'shisha_inventory_movements', 'shisha_stocktakes',
];

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const missing = [];

  for (const tableName of requiredTables) {
    const result = await client.query(
      'SELECT to_regclass($1) IS NOT NULL AS present',
      [`public.${tableName}`],
    );
    if (!result.rows[0]?.present) missing.push(`table:${tableName}`);
  }

  for (const tableName of retiredTables) {
    const result = await client.query(
      'SELECT to_regclass($1) IS NOT NULL AS present',
      [`public.${tableName}`],
    );
    if (result.rows[0]?.present) missing.push(`retired-table-still-present:${tableName}`);
  }

  for (const [tableName, columnName] of requiredColumns) {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS present`,
      [tableName, columnName],
    );
    if (!result.rows[0]?.present) missing.push(`column:${tableName}.${columnName}`);
  }

  for (const constraintName of requiredConstraints) {
    const result = await client.query(
      'SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = $1) AS present',
      [constraintName],
    );
    if (!result.rows[0]?.present) missing.push(`constraint:${constraintName}`);
  }

  for (const indexName of requiredIndexes) {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = $1
       ) AS present`,
      [indexName],
    );
    if (!result.rows[0]?.present) missing.push(`index:${indexName}`);
  }

  for (const tableName of requiredTables) {
    const result = await client.query(
      `SELECT relrowsecurity AS enabled
       FROM pg_class
       WHERE oid = to_regclass($1)`,
      [`public.${tableName}`],
    );
    if (!result.rows[0]?.enabled) {
      missing.push(`rls:${tableName}`);
    }
  }

  if (missing.length > 0) {
    console.error('Inventory schema contract verification failed:');
    for (const item of missing) console.error(`- ${item}`);
    process.exitCode = 1;
  } else {
    console.log('Inventory schema contract verified.');
  }
} catch (error) {
  console.error('Inventory schema contract verification could not run:', error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
