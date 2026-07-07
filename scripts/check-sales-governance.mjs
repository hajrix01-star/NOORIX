import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const files = [
  'src/modules/Sales',
  'src/hooks/useSales.ts',
  'src/hooks/useSalesChannels.ts',
  'src/components/common/SalesActionsCell.tsx',
  'src/services/domains/apiEndpoints/sales-summaries.ts',
  'src/services/domains/apiEndpoints/sales-summaries-batch.ts',
  'src/types/api/domains/sales.ts',
  'backend/src/sales',
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

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

const sourceFiles = files.flatMap((file) => walk(file));
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/(^|[^\w])(:\s*any\b|as\s+any\b|any\[\]|<any>)/.test(source)) {
    fail(file, 'sales scope must not use real any');
  }
  if (/eslint-disable|ts-ignore|TODO|FIXME/.test(source)) {
    fail(file, 'sales scope must not carry suppressions or TODO markers');
  }
  if (/salesApiCompat|postSalesSummaryWithCompat|usedLegacyNoShift|formatShiftNoteTag\(shift\)/.test(source)) {
    fail(file, 'sales shift fallback compatibility path must not return');
  }
  if (/VITE_SALES_USE_BATCH|createDailySalesSummariesSequential|pageSummary\s*\?\?/.test(source)) {
    fail(file, 'sales official batch/list contracts must be strict backend contracts without frontend fallbacks');
  }
}

const screenHook = 'src/modules/Sales/hooks/useDailySalesScreen.ts';
const screenHookSource = fs.readFileSync(path.join(root, screenHook), 'utf8');
for (const pattern of [
  /new Map<string,\s*DailySales/,
  /channelsByVault/,
  /totalAmountSum\s*=\s*sumAmounts/,
  /totalCustomers\s*=\s*.*\.reduce/,
  /avgPerCustomer:\s*[^,\n]+\/[^,\n]+/,
]) {
  if (pattern.test(screenHookSource)) {
    fail(screenHook, 'daily sales list totals/day grouping must come from backend list model');
  }
}

const service = 'backend/src/sales/sales.service.ts';
if (!fs.readFileSync(path.join(root, service), 'utf8').includes('buildSalesSummaryListModel')) {
  fail(service, 'SalesService.findAll must build the official sales list model');
}

if (fs.existsSync(path.join(root, 'src/modules/Sales/components/SalesEditModal.tsx'))) {
  fail('src/modules/Sales/components/SalesEditModal.tsx', 'dead legacy edit modal must stay removed');
}

if (failures.length) {
  console.error('Sales governance check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Sales governance passed.');
