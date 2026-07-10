import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const strictTargets = [
  'src/modules/Expenses',
  'src/services/domains/apiEndpoints/accounts-categories-expense.ts',
  'src/services/queryKeys/expenses.ts',
  'src/types/api/domains/expenses.ts',
  'backend/src/expense-line',
];

const requiredFiles = [
  'src/types/api/domains/expenses.ts',
  'src/modules/Expenses/expenseModels.ts',
  'src/modules/Expenses/expenseModels.test.ts',
  'backend/src/expense-line/expense-line.service.spec.ts',
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
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(file, 'required expenses closure file is missing');
}

for (const file of strictTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in expenses closure scope' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in expenses closure scope' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in expenses closure scope' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in expenses closure scope' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in expenses closure scope' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in expenses closure scope' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in expenses closure scope' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in expenses closure scope' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in expenses closure scope' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

const paymentHistory = read('src/modules/Expenses/components/PaymentHistoryTab.tsx');
if (/sumAmounts\(|\.reduce\(/.test(paymentHistory)) {
  fail('src/modules/Expenses/components/PaymentHistoryTab.tsx', 'payment history must not calculate official totals from the visible page');
}
if (!paymentHistory.includes('data.sums.outflow')) {
  fail('src/modules/Expenses/components/PaymentHistoryTab.tsx', 'payment history must use backend invoice-list summary totals');
}

const detailModal = read('src/modules/Expenses/components/ExpenseLineDetailModal.tsx');
if (!detailModal.includes('periodSummary')) {
  fail('src/modules/Expenses/components/ExpenseLineDetailModal.tsx', 'expense line detail must use backend periodSummary');
}

const service = read('backend/src/expense-line/expense-line.service.ts');
if (!service.includes('periodSummary') || !service.includes('this.prisma.invoice.aggregate')) {
  fail('backend/src/expense-line/expense-line.service.ts', 'expense line payments must expose backend period summary');
}

const endpoints = read('src/services/domains/apiEndpoints/accounts-categories-expense.ts');
if (/includeInactive:\s*any|page:\s*any|pageSize:\s*any/.test(endpoints)) {
  fail('src/services/domains/apiEndpoints/accounts-categories-expense.ts', 'expense API endpoints must be typed');
}
for (const required of [
  'Promise<ApiParsedResult<ExpenseLineRecord[]>>',
  'Promise<ApiParsedResult<ExpenseLineRecord>>',
  'Promise<ApiParsedResult<ExpenseLinePaymentsPage>>',
]) {
  if (!endpoints.includes(required)) {
    fail('src/services/domains/apiEndpoints/accounts-categories-expense.ts', `missing typed expense endpoint contract ${required}`);
  }
}

if (failures.length) {
  console.error('Expenses governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Expenses governance passed.');
