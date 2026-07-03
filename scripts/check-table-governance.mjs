import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function walk(dir, predicate, acc = []) {
  for (const entry of readdirSync(path.join(root, dir))) {
    const relativePath = path.join(dir, entry);
    const fullPath = path.join(root, relativePath);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(entry)) {
        walk(relativePath, predicate, acc);
      }
    } else if (predicate(relativePath)) {
      acc.push(relativePath.replaceAll('\\', '/'));
    }
  }
  return acc;
}

function fail(file, line, message) {
  failures.push(`${file}${line ? `:${line}` : ''} - ${message}`);
}

const governanceDoc = '.cursor/rules/tables-audit.mdc';
const governanceText = read(governanceDoc);
const manualTableRegistryPath = 'scripts/table-manual-exceptions.json';
const manualTableRegistry = JSON.parse(read(manualTableRegistryPath));
const allowedManualTableCounts = manualTableRegistry.allowedTableCounts ?? {};
const manualTableReasonsPath = 'scripts/table-manual-reasons.json';
const manualTableReasons = JSON.parse(read(manualTableReasonsPath)).reasons ?? {};
const tableStatusDocPath = 'docs/FRONTEND_TABLE_GOVERNANCE_STATUS.md';
const tableStatusText = read(tableStatusDocPath);
const printTableFoundationDocPath = 'docs/PRINT_TABLE_FOUNDATION.md';
const printTableFoundationText = read(printTableFoundationDocPath);
const printTableBatch1DocPath = 'docs/PRINT_TABLE_CONVERSION_BATCH_1.md';
const printTableBatch1Text = read(printTableBatch1DocPath);
const printTableBatch2DocPath = 'docs/PRINT_TABLE_CONVERSION_BATCH_2.md';
const printTableBatch2Text = read(printTableBatch2DocPath);
const simpleTableDashboardDocPath = 'docs/SIMPLE_TABLE_DASHBOARD_CONVERSION.md';
const simpleTableDashboardText = read(simpleTableDashboardDocPath);
const catalogPrintTableDocPath = 'docs/CATALOG_PRINT_TABLE_CONVERSION.md';
const catalogPrintTableText = read(catalogPrintTableDocPath);
const dashboardCalendarPrintTableDocPath = 'docs/DASHBOARD_CALENDAR_PRINT_TABLE_CONVERSION.md';
const dashboardCalendarPrintTableText = read(dashboardCalendarPrintTableDocPath);
const allowedManualTableCategories = new Set([
  'bank-print',
  'bank-protected',
  'dashboard-matrix',
  'document-print',
  'editable-grid',
  'financial-report',
  'hr-financial',
  'matrix-table',
  'payroll-protected',
  'print-export-html',
  'print-financial',
  'purchases-protected',
  'tax-print',
  'tax-protected',
]);
const allowedManualTableDecisions = new Set([
  'leave',
  'convert-to-simple-table',
  'convert-to-smart-table',
  'future-print-table',
  'future-matrix-table',
]);

for (const required of [
  'Table Governance Addendum',
  'مصدر الحقيقة النهائي للجداول',
  'Checklist إغلاق الجداول',
  '--noorix-table-*',
]) {
  if (!governanceText.includes(required)) {
    fail(governanceDoc, null, `missing required governance section: ${required}`);
  }
}

const cssFiles = walk('src', (file) => file.endsWith('.css'));
for (const file of cssFiles) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (line.includes('--nx-table-head-bg:') && !line.includes('var(--noorix-table-header-bg)')) {
      fail(file, lineNo, '--nx-table-head-bg must alias --noorix-table-header-bg');
    }
    if (line.includes('--nx-table-line:') && !line.includes('var(--noorix-table-header-border)')) {
      fail(file, lineNo, '--nx-table-line must alias --noorix-table-header-border');
    }
    if (line.includes('--nx-table-col-line:') && !line.includes('var(--noorix-table-header-border)')) {
      fail(file, lineNo, '--nx-table-col-line must alias --noorix-table-header-border');
    }
  });

  if (file !== 'src/index.css' && /\.noorix-table(?!-)/.test(text)) {
    fail(file, null, '.noorix-table visual rules belong in src/index.css only');
  }
}

const sourceFiles = walk('src', (file) => /\.(tsx|ts|jsx|js)$/.test(file));
const weakHeaderTextPattern =
  /bg-\[var\(--noorix-table-header-bg\)\].*(text-noorix-muted|text-noorix-text)|(text-noorix-muted|text-noorix-text).*bg-\[var\(--noorix-table-header-bg\)\]/;

for (const file of sourceFiles) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (weakHeaderTextPattern.test(line)) {
      fail(file, index + 1, 'table header background must not use muted/default text color');
    }
  });
}

const centralTableBuilderFiles = new Set([
  'src/ui/SmartTable/SmartTable.tsx',
  'src/ui/SimpleTable.tsx',
  'src/ui/MatrixTable.tsx',
  'src/utils/printTableHtml.ts',
  'src/utils/printTableHtml.test.ts',
]);

const currentManualTableCounts = {};
for (const file of sourceFiles) {
  if (centralTableBuilderFiles.has(file)) continue;
  const count = read(file).split(/\r?\n/).filter((line) => line.includes('<table')).length;
  if (count > 0) currentManualTableCounts[file] = count;
}

for (const [file, count] of Object.entries(currentManualTableCounts)) {
  const allowed = allowedManualTableCounts[file] ?? 0;
  if (count > allowed) {
    fail(
      file,
      null,
      `manual <table> count is ${count}, allowed ${allowed}; use SmartTable/SimpleTable or update ${manualTableRegistryPath} with a documented exception`,
    );
  }
}

for (const [file, allowed] of Object.entries(allowedManualTableCounts)) {
  const current = currentManualTableCounts[file] ?? 0;
  if (current < allowed) {
    fail(file, null, `manual <table> registry is stale: allowed ${allowed}, current ${current}`);
  }
  const reason = manualTableReasons[file];
  if (!reason?.category || !reason?.decision || !reason?.reason) {
    fail(file, null, `manual <table> registry is missing a documented reason in ${manualTableReasonsPath}`);
  } else {
    if (!allowedManualTableCategories.has(reason.category)) {
      fail(file, null, `manual <table> category "${reason.category}" is not in the governed category allowlist`);
    }
    if (!allowedManualTableDecisions.has(reason.decision)) {
      fail(file, null, `manual <table> decision "${reason.decision}" is not in the governed decision allowlist`);
    }
  }
}

for (const file of Object.keys(manualTableReasons)) {
  if (!(file in allowedManualTableCounts)) {
    fail(file, null, `manual <table> reason is stale: no matching entry in ${manualTableRegistryPath}`);
  }
}

const manualTableFileCount = Object.keys(allowedManualTableCounts).length;
const manualTableTotal = Object.values(allowedManualTableCounts).reduce((sum, count) => sum + count, 0);
for (const required of [
  'Manual `<table>` outside `src/ui`',
  'Files with manual tables outside `src/ui`',
  `| Manual \`<table>\` outside \`src/ui\` | ${manualTableTotal} |`,
  `| Files with manual tables outside \`src/ui\` | ${manualTableFileCount} |`,
  '`scripts/table-manual-exceptions.json`',
  '`scripts/table-manual-reasons.json`',
  '`scripts/check-table-governance.mjs`',
  '`docs/PRINT_TABLE_FOUNDATION.md`',
  '`docs/PRINT_TABLE_CONVERSION_BATCH_1.md`',
  '`docs/PRINT_TABLE_CONVERSION_BATCH_2.md`',
  '`docs/SIMPLE_TABLE_DASHBOARD_CONVERSION.md`',
  '`docs/CATALOG_PRINT_TABLE_CONVERSION.md`',
  '`docs/DASHBOARD_CALENDAR_PRINT_TABLE_CONVERSION.md`',
]) {
  if (!tableStatusText.includes(required)) {
    fail(tableStatusDocPath, null, `table governance status doc is stale or missing: ${required}`);
  }
}

for (const required of [
  'Status: foundation implemented; broad table conversion is not started.',
  '`src/utils/printTableHtml.ts`',
  '`src/utils/pdfTableExport.ts`',
  'Tax/VAT print documents',
  'This phase closes the foundation only. It does not claim that all remaining manual tables are converted.',
]) {
  if (!printTableFoundationText.includes(required)) {
    fail(printTableFoundationDocPath, null, `print table foundation doc is stale or missing: ${required}`);
  }
}

for (const required of [
  '| Manual `<table>` outside `src/ui` | 69 | 62 | -7 |',
  '`src/modules/Expenses/components/ExpenseLineDetailModal.tsx`',
  '`src/modules/Sales/hooks/useDailySalesScreen.ts`',
  '`src/modules/Orders/utils/itemsCatalogWeeklyPrint.ts`',
  '`npm.cmd run check:table-governance`',
]) {
  if (!printTableBatch1Text.includes(required)) {
    fail(printTableBatch1DocPath, null, `print table batch 1 doc is stale or missing: ${required}`);
  }
}

for (const required of [
  '| Manual `<table>` outside `src/ui` | 62 | 58 | -4 |',
  '`src/modules/Invoices/useInvoicesListActions.ts`',
  '`src/modules/Invoices/utils/buildInvoicesCashReportPrint.ts`',
  '`src/modules/Suppliers/components/SupplierProfileModal.tsx`',
  '`npm.cmd run check:table-governance`',
]) {
  if (!printTableBatch2Text.includes(required)) {
    fail(printTableBatch2DocPath, null, `print table batch 2 doc is stale or missing: ${required}`);
  }
}

for (const required of [
  '| Manual `<table>` outside `src/ui` | 58 | 57 | -1 |',
  '`src/modules/Dashboard/overview/components/DashboardOverviewWeeklySalesPanel.tsx`',
  '`SimpleTable`',
  '`npm.cmd run check:table-governance`',
]) {
  if (!simpleTableDashboardText.includes(required)) {
    fail(simpleTableDashboardDocPath, null, `simple table dashboard conversion doc is stale or missing: ${required}`);
  }
}

for (const required of [
  '| Manual `<table>` outside `src/ui` | 57 | 55 | -2 |',
  '`src/modules/Orders/utils/itemsCatalogPrint.ts`',
  '`src/modules/Orders/utils/itemsCatalogWeeklyPrint.ts`',
  '`buildPrintHtmlTable`',
  '`npm.cmd run test -- itemsCatalogPrint itemsCatalogWeeklyPrint printTableHtml`',
]) {
  if (!catalogPrintTableText.includes(required)) {
    fail(catalogPrintTableDocPath, null, `catalog print table conversion doc is stale or missing: ${required}`);
  }
}

for (const required of [
  '| Manual `<table>` outside `src/ui` | 55 | 54 | -1 |',
  '`src/modules/Dashboard/components/DashboardCalendarTab/hooks/useDashboardCalendarTab.ts`',
  '`buildPrintHtmlTable`',
  '`npm.cmd run check:table-governance`',
]) {
  if (!dashboardCalendarPrintTableText.includes(required)) {
    fail(dashboardCalendarPrintTableDocPath, null, `dashboard calendar print table conversion doc is stale or missing: ${required}`);
  }
}

if (failures.length > 0) {
  console.error('Table governance check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Table governance check passed.');
