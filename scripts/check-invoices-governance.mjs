import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const invoicesRoot = path.join(root, 'src', 'modules', 'Invoices');

const allowedRawTableFiles = new Set([
  path.join(invoicesRoot, 'components', 'DayCloseReportBody.tsx'),
]);

const allowedPrintHtmlFiles = new Set([
  path.join(invoicesRoot, 'utils', 'buildInvoicesCashReportPrint.ts'),
  path.join(invoicesRoot, 'useInvoicesListActions.ts'),
]);

const violations = [];

const requiredFiles = [
  path.join(invoicesRoot, 'invoicesListFilterModel.ts'),
  path.join(invoicesRoot, 'invoicesListFilterModel.test.ts'),
  path.join(invoicesRoot, 'invoicesListQueryModel.ts'),
  path.join(invoicesRoot, 'invoicesListQueryModel.test.ts'),
  path.join(invoicesRoot, 'invoicesListUrlModel.ts'),
  path.join(invoicesRoot, 'invoicesListUrlModel.test.ts'),
  path.join(invoicesRoot, 'invoicesListImportExportModel.ts'),
  path.join(invoicesRoot, 'invoicesListImportExportModel.test.ts'),
  path.join(invoicesRoot, 'invoiceEditModel.ts'),
  path.join(invoicesRoot, 'invoiceEditModel.test.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'invoice-list-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'invoice-list-query.test.ts'),
  path.join(root, 'backend', 'src', 'invoice', 'dto', 'invoice-list-query.dto.ts'),
  path.join(root, 'backend', 'src', 'invoice', 'invoice-list-query-contract.util.ts'),
  path.join(root, 'backend', 'src', 'invoice', 'invoice-list-query-contract.util.spec.ts'),
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    inspectFile(fullPath);
  }
}

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');

  if (/<select\b/.test(source)) {
    report(filePath, 'raw <select> is not allowed in invoices; use SearchableOptionsPicker or a central ui control.');
  }

  if (/<Input\b[^>]*type=["']select["']/.test(source)) {
    report(filePath, 'Input type="select" is not allowed in invoices; use SearchableOptionsPicker or a central ui control.');
  }

  if (
    /<div\s+className=["'][^"']*\bday-close-no-print\b/.test(source) ||
    /<div\s+className=["'][^"']*\bnx-toolbar\b/.test(source)
  ) {
    report(filePath, 'local action/filter toolbar markup is not allowed in invoices; use Toolbar or FilterToolbar.');
  }

  if (!allowedRawTableFiles.has(filePath) && /<table\b/.test(source)) {
    report(filePath, 'raw JSX tables are not allowed in invoices screens; use SmartTable/SimpleTable unless this is protected print-only report body.');
  }

  if (!allowedPrintHtmlFiles.has(filePath) && /buildPrintTableHtml\b/.test(source)) {
    report(filePath, 'print table HTML generation must stay in approved invoice print builders/actions only.');
  }

  if (
    /filter(?:SupplierId|SupplierCategoryId|VaultId|CreatedByUserId|HasNotesOnly)\s*\|\|\s*undefined/.test(source) ||
    /urlExtra\.(?:categoryId|expenseLineId)\s*\|\|\s*undefined/.test(source) ||
    /debouncedQ\s*\|\|\s*undefined/.test(source)
  ) {
    report(filePath, 'invoice filter normalization must stay in invoicesListQueryModel.');
  }
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) {
    report(requiredFile, 'required invoice centrality file is missing.');
  }
}

const filtersToolbarPath = path.join(invoicesRoot, 'components', 'InvoicesListFiltersToolbar.tsx');
if (fs.existsSync(filtersToolbarPath)) {
  const filtersToolbarSource = fs.readFileSync(filtersToolbarPath, 'utf8');
  if (!filtersToolbarSource.includes('../invoicesListFilterModel')) {
    report(filtersToolbarPath, 'invoice filter toolbar must source option lists from invoicesListFilterModel.');
  }
}

const listScreenHookPath = path.join(invoicesRoot, 'useInvoicesListScreen.ts');
if (fs.existsSync(listScreenHookPath)) {
  const listScreenSource = fs.readFileSync(listScreenHookPath, 'utf8');
  if (!listScreenSource.includes('./invoicesListQueryModel')) {
    report(listScreenHookPath, 'invoice list hook must normalize API filters through invoicesListQueryModel.');
  }
  if (!listScreenSource.includes('./invoicesListUrlModel')) {
    report(listScreenHookPath, 'invoice list hook must read drilldown URL state through invoicesListUrlModel.');
  }
  if (!listScreenSource.includes('./invoicesListImportExportModel')) {
    report(listScreenHookPath, 'invoice list hook must delegate ImportExport fetching to invoicesListImportExportModel.');
  }
  if (/searchParams\.get\(/.test(listScreenSource)) {
    report(listScreenHookPath, 'invoice list hook must not parse URL params inline; use invoicesListUrlModel.');
  }
  if (/getInvoices\(/.test(listScreenSource) || /unwrapApiList\b/.test(listScreenSource)) {
    report(listScreenHookPath, 'invoice list hook must not call invoice APIs directly for ImportExport exports.');
  }
}

const listActionsPath = path.join(invoicesRoot, 'useInvoicesListActions.ts');
if (fs.existsSync(listActionsPath)) {
  const listActionsSource = fs.readFileSync(listActionsPath, 'utf8');
  if (!listActionsSource.includes('./invoicesListQueryModel')) {
    report(listActionsPath, 'invoice export and print actions must normalize API filters through invoicesListQueryModel.');
  }
  if (/handlePrintCashReport/.test(listActionsSource)) {
    report(listActionsPath, 'cash report printing is owned by InvoicesCashReportModal; do not keep duplicate action handlers.');
  }
}

const editModalPath = path.join(invoicesRoot, 'components', 'InvoiceEditModal.tsx');
if (fs.existsSync(editModalPath)) {
  const editModalSource = fs.readFileSync(editModalPath, 'utf8');
  if (!editModalSource.includes('../invoiceEditModel')) {
    report(editModalPath, 'invoice edit modal must delegate financial form rules to invoiceEditModel.');
  }
  if (/splitTaxFromTotalAsNumbers|parseFloat\(form\.totalAmount\)|Number\.parseFloat\(form\.totalAmount\)/.test(editModalSource)) {
    report(editModalPath, 'invoice edit modal must not calculate tax or validate totals inline.');
  }
}

const invoicesApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'invoices.ts');
if (fs.existsSync(invoicesApiPath)) {
  const source = fs.readFileSync(invoicesApiPath, 'utf8');
  if (!source.includes('buildInvoiceListApiQuery')) {
    report(invoicesApiPath, 'GET invoices API must build query params through invoice-list-query.');
  }
  if (/const\s+params\s*:\s*Record<string,\s*string>\s*=\s*\{/.test(source)) {
    report(invoicesApiPath, 'GET invoices API must not rebuild query params inline.');
  }
}

const invoiceControllerPath = path.join(root, 'backend', 'src', 'invoice', 'invoice.controller.ts');
if (fs.existsSync(invoiceControllerPath)) {
  const source = fs.readFileSync(invoiceControllerPath, 'utf8');
  if (!source.includes('InvoiceListQueryDto') || !source.includes('normalizeInvoiceListQuery')) {
    report(invoiceControllerPath, 'invoice controller must use InvoiceListQueryDto and normalizeInvoiceListQuery for list queries.');
  }
  const findAllBlock = source.match(/async\s+findAll\([\s\S]*?\n\s*\}\n\n\s*@Get\(':id\/attachment\/download'\)/)?.[0] ?? '';
  if (/@Query\('(?:page|pageSize|startDate|endDate|kind|supplierId|supplierCategoryId|categoryId|expenseLineId|vaultId|sortBy|sortDir|includeCancelled|hasNotes|createdByUserId|requireExpenseLine)'/.test(findAllBlock)) {
    report(invoiceControllerPath, 'invoice list controller must not define long per-field @Query decorators.');
  }
}

const invoiceServicePath = path.join(root, 'backend', 'src', 'invoice', 'invoice.service.ts');
if (fs.existsSync(invoiceServicePath)) {
  const source = fs.readFileSync(invoiceServicePath, 'utf8');
  if (!source.includes('InvoiceListQueryContract')) {
    report(invoiceServicePath, 'invoice service must receive the central InvoiceListQueryContract for list queries.');
  }
}

const invoiceQueryPartsPath = path.join(root, 'backend', 'src', 'invoice', 'invoice-list-query-parts.util.ts');
if (fs.existsSync(invoiceQueryPartsPath)) {
  const source = fs.readFileSync(invoiceQueryPartsPath, 'utf8');
  if (!source.includes('InvoiceListQueryContract')) {
    report(invoiceQueryPartsPath, 'invoice query parts builder must consume InvoiceListQueryContract.');
  }
}

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  if (!roadmap.includes('invoicesListFilterModel')) {
    report(roadmapPath, 'roadmap must document the invoice filter option model.');
  }
  if (!roadmap.includes('invoicesListQueryModel')) {
    report(roadmapPath, 'roadmap must document the invoice query model.');
  }
  if (!roadmap.includes('invoicesListUrlModel')) {
    report(roadmapPath, 'roadmap must document the invoice URL drilldown model.');
  }
  if (!roadmap.includes('invoicesListImportExportModel')) {
    report(roadmapPath, 'roadmap must document the invoice ImportExport model.');
  }
  if (!roadmap.includes('invoiceEditModel')) {
    report(roadmapPath, 'roadmap must document the invoice edit model.');
  }
  if (!roadmap.includes('invoice-list-query')) {
    report(roadmapPath, 'roadmap must document the frontend invoice API query helper.');
  }
  if (!roadmap.includes('InvoiceListQueryDto')) {
    report(roadmapPath, 'roadmap must document the backend invoice list DTO.');
  }
}

walk(invoicesRoot);

if (violations.length) {
  console.error('Invoices governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Invoices governance passed.');
