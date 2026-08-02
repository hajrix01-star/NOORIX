import fs from 'node:fs';
import path from 'node:path';
import {
  operationalQuantityMultiplierFailures,
  ordersV2SnapshotConventionFailures,
} from './orders-governance-rules.mjs';

const root = process.cwd();
const failures = [];

const strictTargets = [
  'src/modules/Orders',
  'src/hooks/useOrders.ts',
  'src/services/domains/apiEndpoints/orders.ts',
  'src/services/queryKeys/orders.ts',
  'src/types/api/domains/orders.ts',
  'src/utils/ordersExport.ts',
  'backend/src/orders',
];

const requiredFiles = [
  'src/types/api/domains/orders.ts',
  'src/modules/Orders/utils/ordersReportModel.ts',
  'src/modules/Orders/components/OrderConfirmModal.tsx',
  'backend/src/orders/orders-month-summary.util.ts',
];

const legacyRuntimeTargets = [
  'src/modules/Orders',
  'src/hooks/useOrders.ts',
  'src/hooks/orders',
  'src/services/domains/apiEndpoints/orders.ts',
  'src/services/queryKeys/orders.ts',
  'src/types/api',
  'backend/src/orders',
  'backend/src/owner/owner-admin-dashboard.service.ts',
  'backend/src/owner/owner-admin-dashboard.service.spec.ts',
];

const legacyShishaRuntimeChecks = [
  { pattern: /shishaInventory/, message: 'legacy shisha inventory runtime is removed; use recipe inventory instead' },
  { pattern: /ShishaInventory/, message: 'legacy shisha inventory runtime is removed; use recipe inventory instead' },
  { pattern: /shisha-inventory/, message: 'legacy shisha inventory endpoint is removed; use recipe inventory instead' },
  { pattern: /ShishaPurchaseSheet/, message: 'legacy shisha purchase sheet is removed; use orders purchase flow instead' },
  { pattern: /useShishaInventory/, message: 'legacy shisha inventory hook is removed; use recipe inventory hooks instead' },
];

const operationalQuantityMultiplierTargets = [
  'backend/src/orders/dto',
  'backend/src/orders/orders.controller.ts',
  'backend/src/orders/orders-staff.types.ts',
  'backend/src/orders/orders-catalog-product.types.ts',
  'backend/src/orders/orders.service.ts',
  'src/services/domains/apiEndpoints/orders.ts',
  'src/hooks/useOrders.ts',
  'src/hooks/orders',
  'src/types/api/domains/orders.ts',
];

function walk(target, acc = []) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return acc;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(full)) {
      if (['node_modules', 'dist', 'build'].includes(entry)) continue;
      walk(path.join(target, entry), acc);
    }
  } else if (/\.(ts|tsx|js|mjs)$/.test(target)) {
    acc.push(target.replaceAll('\\', '/'));
  }
  return acc;
}

function read(file) {
  return fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
}

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(file, 'required orders closure file is missing');
}

for (const file of strictTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in orders closure scope' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in orders closure scope' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in orders closure scope' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in orders closure scope' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in orders closure scope' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in orders closure scope' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in orders closure scope' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in orders closure scope' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in orders closure scope' },
    { pattern: /window\.confirm|window\.print\(/, message: 'direct browser confirm/print is not allowed in orders closure scope' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

for (const file of legacyRuntimeTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  for (const check of legacyShishaRuntimeChecks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

for (const file of operationalQuantityMultiplierTargets.flatMap((target) => walk(target))) {
  for (const message of operationalQuantityMultiplierFailures(file, read(file))) {
    fail(file, message);
  }
}

for (const message of ordersV2SnapshotConventionFailures({
  schema: read('backend/prisma/schema.prisma'),
  ordersService: read('backend/src/orders/orders.service.ts'),
  consumptionSnapshot: read('backend/src/orders/orders-inventory-consumption-snapshot.util.ts'),
  snapshotSql: read('backend/src/orders/orders-inventory-snapshot.sql.ts'),
})) {
  fail('Orders V2 snapshot/schema', message);
}

const ordersTab = read('src/modules/Orders/components/OrdersTab.tsx');
if (!ordersTab.includes('useOrdersRangeSummary(companyId, startDate, endDate)')) {
  fail('src/modules/Orders/components/OrdersTab.tsx', 'orders range summary must come from the backend-owned range summary hook');
}
if (/getDailySalesSummaries|salesKeys\.summaries|computeCashSalesTotal|computeOrdersRangeRollup/.test(ordersTab)) {
  fail('src/modules/Orders/components/OrdersTab.tsx', 'orders screen must not derive official summary numbers from paginated sales data or frontend rollups');
}
if (/cashRemaining\s*=\s*cashSales\s*-/.test(read('src/modules/Orders/components/OrdersSummaryCard.tsx'))) {
  fail('src/modules/Orders/components/OrdersSummaryCard.tsx', 'summary card must not own official cash remaining arithmetic');
}
if (!read('src/services/domains/apiEndpoints/orders.ts').includes('getOrdersRangeSummary')) {
  fail('src/services/domains/apiEndpoints/orders.ts', 'missing backend-owned orders range summary endpoint wrapper');
}
if (!read('backend/src/orders/orders.service.ts').includes('getRangeSummary')) {
  fail('backend/src/orders/orders.service.ts', 'missing backend-owned orders range summary service');
}

const apiTypes = read('src/types/api/domains/orders.ts');
for (const requiredType of [
  'OrderRecord',
  'OrderSummary',
  'OrderItemsReportRow',
  'StaffOrder',
  'OrderProductPayload',
  'OrderCategoryPayload',
]) {
  if (!apiTypes.includes(requiredType)) {
    fail('src/types/api/domains/orders.ts', `missing central orders contract: ${requiredType}`);
  }
}

const packageJson = read('package.json');
if (!packageJson.includes('"check:orders-governance": "node scripts/check-orders-governance.mjs"')) {
  fail('package.json', 'missing check:orders-governance script');
}
if (!packageJson.includes('"test:orders-governance": "vitest run scripts/check-orders-governance.test.mjs"')) {
  fail('package.json', 'missing focused Orders V2 governance test script');
}

const consolidatedGovernance = read('scripts/check-system-governance-consolidated.mjs');
if (!consolidatedGovernance.includes("'check-orders-governance.mjs'")) {
  fail('scripts/check-system-governance-consolidated.mjs', 'orders governance must run in consolidated governance');
}

const ciWorkflow = read('.github/workflows/ci.yml');
if (!ciWorkflow.includes('npm run check:system-governance-consolidated')) {
  fail('.github/workflows/ci.yml', 'consolidated governance must run in CI');
}

if (failures.length) {
  console.error('Orders governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Orders governance passed.');
