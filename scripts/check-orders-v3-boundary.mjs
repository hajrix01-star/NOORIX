import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function walk(relative, files = []) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return files;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(next, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(next.replaceAll('\\', '/'));
  }
  return files;
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const frontendFiles = walk('src/modules/OrdersV3');
const backendFiles = walk('backend/src/orders-v3');

for (const file of frontendFiles) {
  const source = read(file);
  const forbidden = [
    /modules\/Orders(?:\/|')/,
    /hooks\/useOrders/,
    /hooks\/orders\//,
    /apiEndpoints\/orders(?:'|\")/,
    /\/api\/v1\/orders(?!-v3)/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) failures.push(`${file}: imports or calls the legacy Orders runtime`);
  }
}

for (const file of backendFiles) {
  if (file.endsWith('.spec.ts')) continue;
  const source = read(file);
  const forbidden = [
    /from ['"]\.\.\/orders\//,
    /\.order\.(?:find|create|update|delete|count|groupBy)/,
    /\.orderProduct\./,
    /\.staffOrder\./,
    /\.inventoryMovement\./,
    /\.inventoryLedgerEntryV2\./,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) failures.push(`${file}: depends on a legacy/V2 persistence delegate`);
  }
}

const schema = read('backend/prisma/schema.prisma');
for (const required of [
  'model OrdersV3Unit',
  'model OrdersV3ConversionVersion',
  'model OrdersV3RecipeVersion',
  'model OrdersV3Document',
  'model OrdersV3LedgerEntry',
  'model OrdersV3MigrationMap',
]) {
  if (!schema.includes(required)) failures.push(`backend/prisma/schema.prisma: missing ${required}`);
}

const migration = read('backend/prisma/migrations/20260802090000_create_orders_v3_core/migration.sql');
if (!migration.includes('orders_v3_ledger_immutable')) failures.push('Orders V3 migration: append-only ledger trigger is missing');
if (!migration.includes('ENABLE ROW LEVEL SECURITY')) failures.push('Orders V3 migration: RLS is missing');
if (/REFERENCES "(?:orders|order_products|staff_orders|inventory_movements|inventory_ledger_entries_v2)"/.test(migration)) {
  failures.push('Orders V3 migration: a foreign key targets legacy/V2 Orders storage');
}

if (failures.length) {
  console.error('Orders V3 boundary check failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Orders V3 boundary passed (${frontendFiles.length} frontend files, ${backendFiles.length} backend files).`);
