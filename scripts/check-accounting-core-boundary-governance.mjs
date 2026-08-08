import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const allowedMutationFiles = new Map([
  ['backend/src/financial-core/financial-inflow.service.ts', 'official sales inflow source of truth'],
  ['backend/src/financial-core/financial-inflow-invoice.util.ts', 'official sales inflow invoice/allocation writer'],
  ['backend/src/financial-core/financial-inflow-ledger.util.ts', 'official sales ledger writer'],
  ['backend/src/financial-core/financial-outflow.service.ts', 'official outflow ledger rebuild/sync writer'],
  ['backend/src/financial-core/financial-outflow-persist.util.ts', 'official outflow invoice/ledger/allocation writer'],
  ['backend/src/financial-core/financial-outflow-ledger.util.ts', 'official outflow ledger/allocation rebuild writer'],
  ['backend/src/financial-core/financial-loan-ledger.util.ts', 'official loan opening, payment, and reversal ledger writer'],
  ['backend/src/financial-core/financial-transfer.service.ts', 'official vault transfer ledger writer'],
  ['backend/src/financial-core/financial-cancel.service.ts', 'official cancellation writer for invoices/sales/ledgers'],

  ['backend/src/invoice/invoice-update-in-transaction.util.ts', 'invoice update facade that delegates ledger/tax effects back to FinancialCore'],
  ['backend/src/invoice/invoice-attachment-ops.util.ts', 'non-financial invoice attachment metadata only'],

  ['backend/src/hr/hr-payroll-advance-settlement.util.ts', 'payroll advance settlement metadata and deduction source linking'],
  ['backend/src/company-assets/company-assets.service.ts', 'asset completion marks warranty follow-up metadata only'],

  ['backend/src/backup/backup-logical-import-transaction.util.ts', 'protected logical backup restore/import exception'],
  ['backend/src/backup/backup-logical-import-invoices-assets.util.ts', 'protected logical backup restore invoice/assets exception'],
]);

const requiredPackageScript =
  '"check:accounting-core-boundary-governance": "node scripts/check-accounting-core-boundary-governance.mjs"';

const requiredRegisterPhrases = [
  '## Accounting Core Boundary Governance',
  '`check:accounting-core-boundary-governance`',
  'all official financial mutations must pass through FinancialCore or AccountingCore',
];

const sensitiveMutationPattern =
  /\.(invoice|ledgerEntry|invoiceVaultAllocation)\s*\.\s*(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/g;

function abs(rel) {
  return path.join(root, rel);
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(relPath) {
  const full = abs(relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function fail(fileRel, message) {
  failures.push(`${fileRel}: ${message}`);
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\r\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

for (const [fileRel] of allowedMutationFiles) {
  if (!fs.existsSync(abs(fileRel))) {
    fail(fileRel, 'documented accounting-boundary exception file is missing.');
  }
}

for (const file of walk(abs('backend/src'))) {
  const fileRel = rel(file);
  if (/\.(test|spec)\.(ts|tsx)$/.test(fileRel)) continue;

  const source = fs.readFileSync(file, 'utf8');
  const executableSource = stripComments(source);
  const matches = [...executableSource.matchAll(sensitiveMutationPattern)];
  if (!matches.length) continue;

  if (!allowedMutationFiles.has(fileRel)) {
    for (const match of matches) {
      fail(
        fileRel,
        `direct ${match[1]}.${match[2]} at line ${lineNumber(source, match.index ?? 0)} must go through FinancialCore/AccountingCore or be added as a documented protected exception.`,
      );
    }
  }
}

const accountingCore = read('backend/src/accounting-core/accounting-core.service.ts');
for (const required of [
  'postHrServiceExpense',
  'postLeaveSalarySettlement',
  'postPayrollPaymentBatchInTransaction',
  'reverseFinancialOperation',
  'this.financialCore.processOutflow',
  'this.financialCore.processOutflowBatchInTransaction',
  'this.financialCore.cancelOperation',
]) {
  if (!accountingCore.includes(required)) {
    fail('backend/src/accounting-core/accounting-core.service.ts', `missing required accounting-core delegation: ${required}`);
  }
}

const packageJson = read('package.json');
if (!packageJson.includes(requiredPackageScript)) {
  fail('package.json', 'missing check:accounting-core-boundary-governance script.');
}

const consolidated = read('scripts/check-system-governance-consolidated.mjs');
if (!consolidated.includes('check-accounting-core-boundary-governance.mjs')) {
  fail('scripts/check-system-governance-consolidated.mjs', 'missing accounting core boundary governance in consolidated run.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const phrase of requiredRegisterPhrases) {
  if (!register.includes(phrase)) {
    fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing accounting-boundary register note: ${phrase}`);
  }
}

if (failures.length) {
  console.error('Accounting core boundary governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Accounting core boundary governance passed.');
