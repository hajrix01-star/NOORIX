import pg from 'pg';

const { Client } = pg;

const requiredTables = [
  'inventory_stocktakes',
  'inventory_stocktake_lines',
  'inventory_movements',
];

const requiredColumns = [
  ['order_items', 'inventory_base_quantity_snapshot'],
  ['staff_order_items', 'inventory_consumption_snapshot'],
];

const requiredConstraints = [
  'inventory_stocktakes_pkey',
  'inventory_stocktakes_status_check',
  'inventory_stocktake_lines_pkey',
  'inventory_stocktake_lines_variance_check',
  'inventory_movements_pkey',
  'inventory_movements_type_check',
  'inventory_movements_stocktake_required_check',
  'inventory_stocktake_lines_company_product_fkey',
  'inventory_movements_company_product_fkey',
];

const requiredIndexes = [
  'order_products_company_id_id_key',
  'inventory_stocktakes_company_id_id_key',
  'inventory_stocktakes_company_id_id_stocktake_date_key',
  'inventory_stocktake_lines_stocktake_id_product_id_key',
  'inventory_movements_source_key_key',
];

const client = new Client({ connectionString: process.env.DATABASE_URL });

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
      `SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
       FROM pg_class
       WHERE oid = $1::regclass`,
      [`public.${tableName}`],
    );
    if (!result.rows[0]?.enabled || !result.rows[0]?.forced) {
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
