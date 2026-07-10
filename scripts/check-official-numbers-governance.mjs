import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const allowedOfficialNumberFiles = new Map([
  ['src/hooks/useBatchCalculation.ts', 'central purchase batch draft summary hook'],
  ['src/modules/Expenses/expenseModels.ts', 'expense draft/display model'],
  ['src/modules/Invoices/invoiceEditModel.ts', 'invoice edit draft model'],
  ['src/modules/Purchases/components/BatchEditInvoiceLine.tsx', 'purchase edit draft row preview'],
  ['src/modules/Purchases/components/BatchEditPanel.tsx', 'purchase edit drawer active-row display total'],
  ['src/modules/Purchases/components/BatchPrintSheet.tsx', 'protected purchase print total surface'],
  ['src/modules/Purchases/components/useBatchRowLogic.ts', 'purchase batch draft row calculation'],
  ['src/modules/Purchases/batch/purchaseBatchActionModel.ts', 'purchase batch action model'],
  ['src/modules/Purchases/batch/hooks/usePurchasesBatchActions.ts', 'purchase batch idempotency helper'],
  ['src/modules/Purchases/batch/purchaseBatchTypes.ts', 'purchase batch finance-core type boundary'],
  ['src/modules/Purchases/batch/utils/purchasesBatchGuards.ts', 'purchase batch validation guard'],
  ['src/modules/Reports/costAccountingAppsModel.ts', 'cost-accounting draft/model calculation'],
  ['src/modules/Reports/costAccountingApps/costAccountingAppsScreenUtils.ts', 'cost-accounting VAT constant helper'],
  ['src/modules/Sales/components/SalesDayEditModal.tsx', 'sales edit draft preview before backend save'],
  ['src/modules/Sales/components/SalesEntryModal.tsx', 'sales entry draft preview before backend save'],
  ['src/modules/Sales/components/SalesShiftEntryCard.tsx', 'sales shift draft preview before backend save'],
  ['src/modules/Treasury/treasuryModels.ts', 'treasury display model'],
  ['src/modules/HR/utils/hrCalculations/eos.ts', 'HR calculation compatibility wrapper'],
  ['src/modules/HR/utils/hrCalculations/payroll.ts', 'HR calculation compatibility wrapper'],
  ['src/modules/HR/utils/hrCalculations/salary.ts', 'HR calculation compatibility wrapper'],
]);

const requiredRegisterPhrases = [
  '## Official Numbers Governance Finalization',
  '`check:official-numbers-governance`',
  'frontend owns presentation only',
];

const officialFormulaImportPattern =
  /import\s+(?:[\s\S]*?\b(?:calculatePurchaseBatchSummary|splitTaxFromTotal|splitTaxFromTotalAsNumbers|sumAmounts|sumObjectValues|roundAmount|TAX_RATE)\b[\s\S]*?)\s+from\s+['"][^'"]*(?:@noorix\/finance-core|utils\/format|utils\/math-engine|\.{1,2}\/.*(?:format|math-engine))['"]/;

const officialFormulaTermPattern =
  /\b(calculatePurchaseBatchSummary|splitTaxFromTotal|splitTaxFromTotalAsNumbers|sumAmounts|sumObjectValues|roundAmount)\s*\(/;

const suspiciousOfficialFallbackPatterns = [
  /\?\?\s*[^;\n]*(?:reduce\s*\(|sumAmounts\s*\(|sumObjectValues\s*\(|splitTaxFromTotal\s*\()/,
  /\|\|\s*[^;\n]*(?:reduce\s*\(|sumAmounts\s*\(|sumObjectValues\s*\(|splitTaxFromTotal\s*\()/,
];

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
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isIgnoredFile(fileRel) {
  return /\.(test|spec)\.(ts|tsx)$/.test(fileRel)
    || fileRel.startsWith('src/utils/')
    || fileRel.startsWith('src/types/')
    || fileRel.includes('/types/')
    || fileRel.includes('/constants/');
}

function isAllowedOfficialNumberFile(fileRel) {
  return allowedOfficialNumberFiles.has(fileRel)
    || /(?:^|\/)(?:utils|models)(?:\/|$)/.test(fileRel)
    || /(?:Model|model|Calculations|calculations|Calculator|calculator|Metrics|metrics)\.(ts|tsx)$/.test(fileRel);
}

function fail(fileRel, message) {
  failures.push(`${fileRel}: ${message}`);
}

for (const [fileRel] of allowedOfficialNumberFiles) {
  if (!fs.existsSync(abs(fileRel))) {
    fail(fileRel, 'documented official-number boundary file is missing.');
  }
}

for (const dir of ['src/modules', 'src/hooks', 'src/components']) {
  for (const file of walk(abs(dir))) {
    const fileRel = rel(file);
    if (isIgnoredFile(fileRel)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const hasOfficialFormulaImport = officialFormulaImportPattern.test(source);
    const hasOfficialFormulaTerm = officialFormulaTermPattern.test(source);

    if ((hasOfficialFormulaImport || hasOfficialFormulaTerm) && !isAllowedOfficialNumberFile(fileRel)) {
      fail(fileRel, 'official financial/tax formula use must live in backend, a central model, or a documented draft/print exception.');
    }

    if (
      (fileRel.endsWith('.tsx') || fileRel.includes('/hooks/'))
      && hasOfficialFormulaTerm
      && !allowedOfficialNumberFiles.has(fileRel)
    ) {
      for (const pattern of suspiciousOfficialFallbackPatterns) {
        if (pattern.test(source)) {
          fail(fileRel, 'screen/hook contains a suspicious local fallback around official-number aggregation.');
          break;
        }
      }
    }
  }
}

const packageJson = read('package.json');
if (!packageJson.includes('"check:official-numbers-governance": "node scripts/check-official-numbers-governance.mjs"')) {
  fail('package.json', 'missing check:official-numbers-governance script.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const phrase of requiredRegisterPhrases) {
  if (!register.includes(phrase)) {
    fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing official-number register note: ${phrase}`);
  }
}

if (register.includes('- Central official-number rule: backend or shared domain model owns accounting values; frontend owns presentation only.')) {
  fail('docs/SECTION_UNIFICATION_REGISTER.md', 'official-number rule is still listed as backlog instead of closed governance.');
}

if (failures.length) {
  console.error('Official-numbers governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Official-numbers governance passed.');
