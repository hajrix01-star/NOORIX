import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowedSharedShim = 'src/shared/components/FilterToolbar.tsx';
const allowedCommonPickerShim = 'src/components/common/SearchableOptionsPicker.tsx';
const allowedFilterToolbar = 'src/ui/filters/FilterToolbar.tsx';
const docsPath = 'docs/FILTER_CENTRALITY_ROADMAP.md';
const failures = [];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx|js|jsx|md)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function isFilterSurface(normalized) {
  const base = path.basename(normalized);
  if (/Form|Modal|Sheet|Preview|Settings|BatchRow|PurchasesBatchToolbar/.test(base)) return false;
  return /Filter|Toolbar|ReportTab|TransactionsFullTab|DashboardAppSalesTab|AnalysisScreen|DashboardScreen/.test(base);
}

for (const file of walk(path.join(root, 'src'))) {
  const normalized = rel(file);
  const text = fs.readFileSync(file, 'utf8');
  if (normalized !== allowedSharedShim && text.includes('shared/components/FilterToolbar')) {
    failures.push(`${normalized} imports FilterToolbar through shared/components; use src/ui instead`);
  }
  if (normalized !== allowedCommonPickerShim && text.includes('components/common/SearchableOptionsPicker')) {
    failures.push(`${normalized} imports SearchableOptionsPicker through components/common; use src/ui instead`);
  }
  if (normalized !== allowedFilterToolbar && /<div\s+className=["'`][^"'`]*noorix-exec-filters\b/.test(text)) {
    failures.push(`${normalized} uses execution filter classes directly; use FilterToolbar variant="execution" instead`);
  }
  if ((normalized.startsWith('src/modules/') || normalized.startsWith('src/components/')) && isFilterSurface(normalized)) {
    if (/<select\b/.test(text)) {
      failures.push(`${normalized} renders a raw <select>; use SearchableOptionsPicker or an approved ui primitive`);
    }
    if (/type=["']select["']/.test(text)) {
      failures.push(`${normalized} renders Input type="select"; use SearchableOptionsPicker for filter choices`);
    }
    if (text.includes('DateMonthScopePicker') || text.includes('DateFilterMonthPicker')) {
      failures.push(`${normalized} uses a legacy date filter; use DateFilterBar, YearDateFilter, or MonthDateFilter`);
    }
  }
}

const docsText = fs.existsSync(path.join(root, docsPath))
  ? fs.readFileSync(path.join(root, docsPath), 'utf8')
  : '';

for (const required of [
  'src/ui/filters/FilterToolbar',
  'src/ui/filters/SearchableOptionsPicker',
  'variant="execution"',
  'variant="bare"',
  'csvToFilterValues',
  'filterValuesToCsv',
  'src/shared/components/FilterToolbar.tsx',
  'src/components/common/SearchableOptionsPicker.tsx',
  'Build from scratch',
]) {
  if (!docsText.includes(required)) {
    failures.push(`${docsPath} is missing required filter centrality note: ${required}`);
  }
}

if (failures.length > 0) {
  console.error('Filter governance check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Filter governance check passed.');
