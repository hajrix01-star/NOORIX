import fs from 'node:fs';
import path from 'node:path';
import {
  LEGACY_ORDERS_PATHS,
  findLegacyRuntimeReferences,
} from './orders-governance-rules.mjs';

const root = process.cwd();
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function walk(rel, acc = []) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return acc;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(full)) {
      if (['node_modules', 'dist', 'build', 'coverage', 'migrations'].includes(entry)) continue;
      walk(path.join(rel, entry), acc);
    }
  } else if (/\.(?:ts|tsx|js|mjs)$/.test(rel) && !/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(rel)) {
    acc.push(rel.replaceAll('\\', '/'));
  }
  return acc;
}

for (const rel of LEGACY_ORDERS_PATHS) {
  if (fs.existsSync(path.join(root, rel))) failures.push(`${rel}: legacy Orders path must stay deleted`);
}

for (const rel of ['backend/src', 'src', 'packages/permissions-core/src'].flatMap((dir) => walk(dir))) {
  for (const match of findLegacyRuntimeReferences(read(rel))) failures.push(`${rel}: ${match}`);
}

const appModule = read('backend/src/app.module.ts');
if (!appModule.includes('OrdersV4Module')) failures.push('backend/src/app.module.ts: Orders V4 module is not registered');
if (/\bOrdersModule\b/.test(appModule)) failures.push('backend/src/app.module.ts: legacy Orders module is registered');

const v4Module = read('backend/src/orders-v4/orders-v4.module.ts');
if (/OrdersModule|LegacyCutover|\.\.\/orders/.test(v4Module)) {
  failures.push('backend/src/orders-v4/orders-v4.module.ts: Orders V4 still depends on legacy Orders');
}

const schema = read('backend/prisma/schema.prisma');
for (const model of [
  'OrderCategory', 'OrderSection', 'OrderCatalogUnit', 'OrderConversionTemplate', 'OrderProduct',
  'InventoryStocktake', 'InventoryStocktakeLine', 'InventoryMovement', 'InventoryLocationV2',
  'InventoryDefinitionVersionV2', 'InventoryLedgerEntryV2', 'Order', 'OrderItem', 'StaffOrder', 'StaffOrderItem',
  'ShishaInventorySettings', 'ShishaInventoryMovement', 'ShishaStocktake',
]) {
  if (new RegExp(`model\\s+${model}\\b`).test(schema)) failures.push(`backend/prisma/schema.prisma: legacy model ${model} remains`);
}

const retirement = read('backend/prisma/migrations/20260803180000_retire_legacy_orders/migration.sql');
for (const required of [
  'DROP TABLE IF EXISTS "orders"', 'DROP TABLE IF EXISTS "staff_orders"',
  'DROP TABLE IF EXISTS "shisha_inventory_settings"', 'orders_v4_legacy_archives',
  'Shisha archive parity failed', 'Legacy Orders retirement aborted',
]) {
  if (!retirement.includes(required)) failures.push(`retirement migration: missing ${required}`);
}
if (/DROP TABLE[^;]*CASCADE/i.test(retirement)) failures.push('retirement migration: CASCADE is forbidden');

const backupScript = read('deploy/backup-legacy-orders-before-retirement.sh');
if (!backupScript.includes('pg_dump') || !backupScript.includes('pg_restore --list') || !backupScript.includes('sha256sum')) {
  failures.push('deploy/backup-legacy-orders-before-retirement.sh: verified pre-retirement backup is incomplete');
}
for (const table of ['shisha_inventory_settings', 'shisha_inventory_movements', 'shisha_stocktakes']) {
  if (!backupScript.includes(table)) failures.push(`deploy/backup-legacy-orders-before-retirement.sh: missing ${table}`);
}
if (!read('.github/workflows/deploy.yml').includes('backup-legacy-orders-before-retirement.sh')) {
  failures.push('.github/workflows/deploy.yml: pre-retirement backup is not wired before migrations');
}

if (failures.length) {
  console.error('Orders retirement governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Orders retirement governance passed.');
