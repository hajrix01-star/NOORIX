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

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  if (!roadmap.includes('invoicesListFilterModel')) {
    report(roadmapPath, 'roadmap must document the invoice filter option model.');
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
